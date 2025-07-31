<?php
/**
 * Plugin Name:       WooCommerce Live Order Feed
 * Plugin URI:        https://github.com/MbarekTech/WooCommerce-Live-Order-Feed
 * Description:       Provides a real-time order feed dashboard for WooCommerce with PWA and push notification capabilities.
 * Version:           1.1.0
 * Author:            Your Name Here
 * License:           GPL v2 or later
 * Text Domain:       wc-live-order-feed
 */

if (!defined('ABSPATH')) exit; // Exit if accessed directly

// Use an action hook to initialize our plugin safely, ensuring all WordPress functions are available.
add_action('plugins_loaded', ['WooCommerce_Live_Order_Feed', 'get_instance']);

class WooCommerce_Live_Order_Feed {

    private static $instance = null;
    private const VAPID_PUBLIC_KEY = 'YOUR_PUBLIC_KEY_HERE';
    private const VAPID_PRIVATE_KEY = 'YOUR_PRIVATE_KEY_HERE';

    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->load_dependencies();
        $this->define_hooks();
    }

    private function load_dependencies() {
        // Register activation/deactivation hooks
        register_activation_hook(__FILE__, [$this, 'activate_plugin']);
        register_deactivation_hook(__FILE__, [$this, 'deactivate_plugin']);
    }

    public function autoloader($class) {
        $libraries = [
            'Minishlink\\WebPush\\' => 'lib/web-push/src/',
            'Spomky\\Base64Url\\'   => 'lib/base64url/src/',
            'Firebase\\JWT\\'      => 'lib/jwt/src/',
        ];
        foreach ($libraries as $prefix => $base_dir) {
            $len = strlen($prefix);
            if (strncmp($prefix, $class, $len) !== 0) continue;
            $relative_class = substr($class, $len);
            $file = plugin_dir_path(__FILE__) . $base_dir . str_replace('\\', '/', $relative_class) . '.php';
            if (file_exists($file)) require_once $file;
        }
    }
    
    private function define_hooks() {
        add_action('init', [$this, 'serve_dynamic_files']);
        add_action('wp_head', [$this, 'add_pwa_manifest_link']);
        add_shortcode('live_order_feed', [$this, 'render_shortcode']);
        add_action('wp_ajax_get_live_orders', [$this, 'get_live_orders_ajax_handler']);
        add_action('wp_ajax_nopriv_get_live_orders', [$this, 'get_live_orders_ajax_handler']);
        add_action('wp_ajax_save_push_subscription', [$this, 'save_push_subscription_handler']);
        add_action('wp_ajax_nopriv_save_push_subscription', [$this, 'save_push_subscription_handler']);
        add_action('woocommerce_order_status_processing', [$this, 'trigger_push_notification'], 10, 1);
        add_action('woocommerce_order_status_completed', [$this, 'trigger_push_notification'], 10, 1);
    }
    
    public function add_pwa_manifest_link() {
        if (is_page('live-orders')) { // Your page slug
            echo '<link rel="manifest" href="' . home_url('/?wclof_file=manifest') . '">';
        }
    }
    
    public function serve_dynamic_files() {
        if (!isset($_GET['wclof_file'])) return;

        if ($_GET['wclof_file'] === 'manifest') {
            $manifest = [
                'name' => get_bloginfo('name') . ' Live Orders', 'short_name' => 'Live Orders',
                'start_url' => site_url('/live-orders/'), 'display' => 'standalone',
                'background_color' => '#f4f7fa', 'theme_color' => '#2c3e50',
                'description' => 'Live order feed for ' . get_bloginfo('name'),
                'icons' => [
                    ['src' => plugin_dir_url(__FILE__) . 'assets/icons/icon-192x192.png', 'sizes' => '192x192', 'type' => 'image/png'],
                    ['src' => plugin_dir_url(__FILE__) . 'assets/icons/icon-512x512.png', 'sizes' => '512x512', 'type' => 'image/png']
                ]
            ];
            wp_send_json($manifest);
        }
    }

    public function render_shortcode() {
        if (!is_user_logged_in()) return '<p>You must be logged in to view this page.</p>';

        wp_enqueue_style('wc-live-order-feed-style', plugin_dir_url(__FILE__) . 'assets/css/live-orders.css', [], '1.2.0');
        wp_enqueue_script('wc-live-order-feed-script', plugin_dir_url(__FILE__) . 'assets/js/live-orders.js', ['jquery'], '1.2.0', true);

        wp_localize_script('wc-live-order-feed-script', 'live_order_ajax_object', [
            'ajax_url'    => admin_url('admin-ajax.php'),
            'nonce'       => wp_create_nonce('live_order_feed_nonce'),
            'plugin_assets_url' => plugin_dir_url(__FILE__) . 'assets/js/',
            'vapid_public_key' => self::VAPID_PUBLIC_KEY,
            'urls_to_cache' => [
                site_url('/live-orders/'),
                plugin_dir_url(__FILE__) . 'assets/css/live-orders.css',
                plugin_dir_url(__FILE__) . 'assets/js/live-orders.js',
                plugin_dir_url(__FILE__) . 'assets/js/order-worker.js',
                plugin_dir_url(__FILE__) . 'assets/sounds/notification.mp3',
                plugin_dir_url(__FILE__) . 'assets/icons/icon-192x192.png'
            ],
            'notification_icon_url' => plugin_dir_url(__FILE__) . 'assets/icons/icon-192x192.png',
            'notification_sound_url' => plugin_dir_url(__FILE__) . 'assets/sounds/notification.mp3',
        ]);

        return '<div id="income-bar" class="daily-income-container"><span>Today\'s Income:</span><strong id="daily-income-total">--</strong></div><div id="live-feed-wrapper"><div id="live-feed-top-nav" class="feed-controls-bar"><div id="permission-status" class="status-indicator">Initializing...</div><div class="notification-controls"><label for="notification-toggle" class="toggle-switch"><input type="checkbox" id="notification-toggle" checked><span class="slider"></span></label><span>Notifications</span></div></div><div id="live-order-feed-container"><div id="start-feed-overlay"><div class="start-feed-box"><h2>Live Order Feed</h2><p>Tap to start receiving live orders and enable sound.</p><button id="start-feed-btn">Start Feed</button></div></div></div></div>';
    }

    public function get_live_orders_ajax_handler() {
        check_ajax_referer('live_order_feed_nonce', 'security');
        $recent_orders = wc_get_orders(['limit' => 30, 'orderby' => 'date', 'order' => 'DESC', 'status' => ['wc-completed', 'wc-processing'], 'date_created' => '>' . (time() - (2 * HOUR_IN_SECONDS))]);
        $order_data = [];
        if (!empty($recent_orders)) { 
            foreach ($recent_orders as $order) { 
                $items_array = []; 
                foreach ($order->get_items() as $item) { 
                    $items_array[] = ['name' => $item->get_name(), 'quantity' => $item->get_quantity(), 'total' => strip_tags(wc_price($item->get_total()))]; 
                } 
                $order_data[] = ['id' => $order->get_id(), 'time_gmt' => $order->get_date_created()->getTimestamp(), 'time_local' => $order->get_date_created()->format('H:i'), 'items' => $items_array]; 
            } 
        }
        global $wpdb; $today = date('Y-m-d');
        $total_income = $wpdb->get_var("SELECT SUM(pm2.meta_value) FROM {$wpdb->posts} p JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id JOIN {$wpdb->postmeta} pm2 ON p.ID = pm2.post_id WHERE p.post_type = 'shop_order' AND p.post_status IN ('wc-completed', 'wc-processing') AND pm.meta_key = '_paid_date' AND CAST(pm.meta_value AS DATE) = '{$today}' AND pm2.meta_key = '_order_total'");
        wp_send_json_success(['orders' => $order_data, 'total_income' => wc_price($total_income > 0 ? $total_income : 0)]);
    }

    public function save_push_subscription_handler() {
        if (!is_user_logged_in()) { wp_send_json_error('Not logged in.'); }
        $sub = isset($_POST['subscription']) ? json_decode(stripslashes($_POST['subscription']), true) : null;
        if (!$sub || !isset($sub['endpoint'])) { wp_send_json_error('Invalid data.'); }
        update_user_meta(get_current_user_id(), 'push_subscription_data', $sub);
        wp_send_json_success('Saved.');
    }
    
    public function trigger_push_notification($order_id) {
        if (!class_exists('Minishlink\WebPush\WebPush')) return;
        $order = wc_get_order($order_id); if (!$order) return;
        
        $users_to_notify = get_users(['role__in' => ['administrator', 'shop_manager']]);
        $auth = ['VAPID' => ['subject' => get_bloginfo('url'), 'publicKey' => self::VAPID_PUBLIC_KEY, 'privateKey' => self::VAPID_PRIVATE_KEY]];
        $webPush = new \Minishlink\WebPush\WebPush($auth);
        
        $item_count = $order->get_item_count();
        $first_item = ($item_count > 0) ? current($order->get_items())->get_name() : 'items';
        $payload = json_encode(['title' => "New Order #{$order_id}!", 'body' => "{$item_count} item(s) including \"{$first_item}\".", 'icon' => plugin_dir_url(__FILE__) . 'assets/icons/icon-192x192.png', 'url' => site_url('/live-orders/')]);
        
        foreach ($users_to_notify as $user) {
            $sub_data = get_user_meta($user->ID, 'push_subscription_data', true);
            if ($sub_data) {
                $subscription = \Minishlink\WebPush\Subscription::create($sub_data);
                $webPush->sendOneNotification($subscription, $payload);
            }
        }
        $webPush->flush();
    }
    
    // Plugin activation
    public function activate_plugin() {
        $this->create_database_tables();
    }
    
    // Plugin deactivation
    public function deactivate_plugin() {
        // Clean up if needed
    }
    
    // Create database tables
    private function create_database_tables() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'wclof_push_subscriptions';
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            subscription_data text NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY user_id (user_id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
}
