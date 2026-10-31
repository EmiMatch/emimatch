package com.emimatch.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;

/**
 * Secure external-link bridge for approved Mercado Pago checkout URLs.
 * APK installation and updates are handled by Google Play.
 */
public final class EmiMatchUpdater {
    private final Activity activity;

    public EmiMatchUpdater(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void openExternalUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.length() > 4096) return;

        final Uri uri;
        try {
            uri = Uri.parse(rawUrl);
        } catch (Exception exception) {
            return;
        }

        String scheme = uri.getScheme();
        String host = uri.getHost();
        boolean secure = "https".equalsIgnoreCase(scheme) && host != null;
        boolean trustedHost = secure && (
                host.equalsIgnoreCase("mercadopago.com") ||
                host.endsWith(".mercadopago.com") ||
                host.equalsIgnoreCase("mercadopago.com.ar") ||
                host.endsWith(".mercadopago.com.ar") ||
                host.equalsIgnoreCase("mercadolibre.com") ||
                host.endsWith(".mercadolibre.com") ||
                host.equalsIgnoreCase("mercadolibre.com.ar") ||
                host.endsWith(".mercadolibre.com.ar")
        );

        if (!trustedHost) return;

        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {
                // Keep the app usable if no browser can open the payment URL.
            }
        });
    }
}
