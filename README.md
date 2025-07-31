# WooCommerce Live Order Feed

I got tired of constantly refreshing my WooCommerce orders page to see if new orders came in, so I built this. Now orders show up automatically and I get notifications even when I'm not looking at the screen.

## What it does

- Orders appear on your screen as soon as they come in (no more F5 spam)
- Push notifications work even when you close the browser tab
- Works offline if your internet cuts out temporarily  
- Can install it on your phone like a regular app
- Optional "ding" sound when new orders arrive (toggle it off if it gets annoying)
- Doesn't slow down your browser - runs everything in the background

## Why I built this

Running a WooCommerce store means being glued to your orders page. I was refreshing it every few minutes like a maniac. This plugin lets me actually get work done while still knowing instantly when orders come through.

## Requirements

You'll need:
- WordPress (pretty much any recent version)
- WooCommerce plugin active
- PHP 7.4+ (most hosts have this now)
- HTTPS/SSL for push notifications to work properly

## Setup

Basic install:
1. Download and extract to `/wp-content/plugins/`
2. Activate it in WordPress admin
3. Create a page, add `[live_order_feed]` shortcode
4. Done

## Using it

Just visit your page with the shortcode. If you're logged in, you'll see your orders and get a button to enable notifications. 

The notification permission popup can be annoying - browsers require user interaction before allowing notifications, so you have to click "Enable" first.

On mobile, you might get an "Add to Home Screen" prompt. Do it - makes it feel like a native app.

## Customization

It works out of the box, but if you want to tinker:

### Custom notification keys
The plugin includes VAPID keys for push notifications. You can generate your own at https://vapidkeys.com/ and replace them in the main PHP file if you want.

### Your own icons/sounds
Drop files in the assets folders:
- `assets/icons/` - notification and app icons  
- `assets/sounds/` - change that notification sound
- `assets/css/` - make it look however you want

## Technical stuff

Uses service workers for notifications and caching, web workers for background processing, polls for new orders every 7 seconds. Pretty standard modern web stuff.

Browser support is good - works in Chrome, Firefox, Edge. Safari is... Safari (limited push support).

## If something breaks

**Orders not showing up?**
- Is WooCommerce actually running?
- Are you logged in?
- Check browser console for errors

**No notifications?**
- You need HTTPS (browsers won't do notifications on HTTP)
- Check if you accidentally blocked notifications
- Make sure you clicked "Enable" first

**Can't install as app?**
- Service worker might not be working
- Check if icons are the right size (192px, 512px)

I test this on my own store, so it should work. If it doesn't, open an issue and I'll take a look.

## Contributing

Found a bug? Want to add something? Cool. Fork it, fix it, send a pull request. Try to test your changes first though.

## License

GPL v2 - standard WordPress plugin license.

---

*Note: Needs WooCommerce to be useful. Works best with HTTPS.*
