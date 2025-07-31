<?php
/**
 * Plugin Name:       WooCommerce Live Order Feed
 * Plugin URI:        https://github.com/your-username/woocommerce-live-order-feed
 * Description:       Provides a real-time order feed dashboard for WooCommerce with PWA and push notification capabilities.
 * Version:           1.0.0
 * Author:            Your Name
 * Author URI:        https://your-website.com
 * License:           GPL v2 or later
 * Text Domain:       wc-live-order-feed
 */

if (!defined('ABSPATH')) exit;

add_action('plugins_loaded', ['WooCommerce_Live_Order_Feed', 'get_instance']);

class WooCommerce_Live_Order_Feed {

    private static $instance = null;
    private const VAPID_PUBLIC_KEY = 'BI3fjkkqY5t4-rvsL1M8W0VrsPH3ilfhuMtEjlSRfTbNKmPXqPHwSxzWg_sJbclijV3yBTRl8YW4s5GUf3XeF7g';
    private const VAPID_PRIVATE_KEY = 'wVCZe5JeuPKuH0NT7E-iFzOhJiO1RVrrJpaI3hG_oVk';

    public static function get_instance() {
        if (self::$instance === null) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {
        $this->load_dependencies();
        $this->define_hooks();
    }

    private function load_dependencies() { spl_autoload_register([$this, 'autoloader']); }
    public function autoloader($class) { /* ... same autoloader code from previous version ... */ }
    
    private function define_hooks() {
        add_action('wp_head', [$this, 'add_pwa_manifest_link']);
        add_action('init', [$this, 'serve_dynamic_manifest']);
        add_shortcode('live_order_feed', [$this, 'render_shortcode']);
        add_action('wp_ajax_get_live_orders', [$this, 'get_live_orders_ajax_handler']);
        add_action('wp_ajax_save_push_subscription', [$this, 'save_push_subscription_handler']);
        add_action('woocommerce_order_status_processing', [$this, 'trigger_push_notification'], 10, 1);
        add_action('woocommerce_order_status_completed', [$this, 'trigger_push_notification'], 10, 1);
    }
    
    public function add_pwa_manifest_link() {
        if (is_page('feed-2')) {
            // DYNAMIC: Point to our virtual manifest endpoint
            echo '<link rel="manifest" href="' . home_url('/?wclof_manifest=true') . '">';
        }
    }

    public function serve_dynamic_manifest() {
        if (!isset($_GET['wclof_manifest'])) return;
        
        $manifest = [
            'name' => 'Live Orders',
            'short_name' => 'Live Orders',
            'start_url' => site_url('/feed-2/'),
            'display' => 'standalone',
            'background_color' => '#f4f7fa',
            'theme_color' => '#2c3e50',
            'description' => 'Live order feed for WooCommerce.',
            'icons' => [
                [
                    'src' => esc_url(plugin_dir_url(__FILE__) . 'assets/icons/icon-192x192.png'),
                    'sizes' => '192x192', 'type' => 'image/png'
                ],
                [
                    'src' => esc_url(plugin_dir_url(__FILE__) . 'assets/icons/icon-512x512.png'),
                    'sizes' => '512x512', 'type' => 'image/png'
                ]
            ]
        ];
        wp_send_json($manifest);
    }

    public function render_shortcode() {
        if (!is_user_logged_in()) return '<p>You must be logged in.</p>';

        wp_enqueue_style('wc-live-order-feed-style', plugin_dir_url(__FILE__) . 'assets/css/live-orders.css', [], '1.1.0');
        wp_enqueue_script('wc-live-order-feed-script', plugin_dir_url(__FILE__) . 'assets/js/live-orders.js', ['jquery'], '1.1.0', true);

        // DYNAMIC: Pass all dynamic URLs to JavaScript
        wp_localize_script('wc-live-order-feed-script', 'live_order_ajax_object', [
            'ajax_url'    => admin_url('admin-ajax.php'),
            'nonce'       => wp_create_nonce('live_order_feed_nonce'),
            'plugin_assets_url' => plugin_dir_url(__FILE__) . 'assets/js/',
            'vapid_public_key' => self::VAPID_PUBLIC_KEY,
            'urls_to_cache' => [
                site_url('/feed-2/'),
                plugin_dir_url(__FILE__) . 'assets/css/live-orders.css',
                plugin_dir_url(__FILE__) . 'assets/js/live-orders.js',
                plugin_dir_url(__FILE__) . 'assets/js/order-worker.js',
            ],
            'notification_icon_url' => esc_url(plugin_dir_url(__FILE__) . 'assets/icons/icon-192x192.png'),
            'notification_sound_url' => esc_url(plugin_dir_url(__FILE__) . 'assets/sounds/notification.mp3'),
        ]);

        return '<!-- HTML structure from previous version -->';
    }

    public function get_live_orders_ajax_handler() { /* Unchanged */ }
    public function save_push_subscription_handler() { /* Unchanged */ }
    
    public function trigger_push_notification($order_id) {
        // ... (function content is the same, but one change below)
        $payload = json_encode([
            'title' => "New Order #{$order_id} Received!",
            'body'  => "{$item_count} item(s) including \"{$first_item}\".",
            // DYNAMIC: Use dynamic URL for icon
            'icon'  => esc_url(plugin_dir_url(__FILE__) . 'assets/icons/icon-192x192.png'),
            // DYNAMIC: Use dynamic URL for click action
            'url'   => site_url('/feed-2/')
        ]);
        // ... (rest of the function is the same)
    }
}
