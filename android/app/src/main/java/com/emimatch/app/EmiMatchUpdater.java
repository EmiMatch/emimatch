package com.emimatch.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

/**
 * Opens trusted external payment pages and the official EmiMatch Play Store listing.
 * App updates are delivered only through Google Play.
 */
public final class EmiMatchUpdater {
    private static final String PLAY_STORE_MARKET_URI =
            "market://details?id=com.emimatch.app";
    private static final String PLAY_STORE_WEB_URI =
            "https://play.google.com/store/apps/details?id=com.emimatch.app";

    private final Activity activity;
    private final WebView webView;

    public EmiMatchUpdater(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public void openExternalUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.length() > 4096) {
            reportError("No se pudo abrir el enlace seguro de pago.");
            return;
        }

        final Uri uri;
        try {
            uri = Uri.parse(rawUrl);
        } catch (Exception exception) {
            reportError("El enlace de pago no es válido.");
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

        if (!trustedHost) {
            reportError("Por seguridad, solo se pueden abrir enlaces oficiales de Mercado Pago.");
            return;
        }

        activity.runOnUiThread(() -> openUri(uri, false));
    }

    @JavascriptInterface
    public void openPlayStore() {
        activity.runOnUiThread(() -> {
            try {
                Intent marketIntent = new Intent(
                        Intent.ACTION_VIEW, Uri.parse(PLAY_STORE_MARKET_URI));
                marketIntent.setPackage("com.android.vending");
                activity.startActivity(marketIntent);
            } catch (Exception marketException) {
                try {
                    Intent webIntent = new Intent(
                            Intent.ACTION_VIEW, Uri.parse(PLAY_STORE_WEB_URI));
                    activity.startActivity(webIntent);
                } catch (Exception webException) {
                    reportError("No se pudo abrir Google Play. Buscá EmiMatch en Play Store para actualizar.");
                }
            }
        });
    }

    private void openUri(Uri uri, boolean unused) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            activity.startActivity(intent);
        } catch (Exception exception) {
            reportError("No se pudo abrir Mercado Pago. Verificá que tengas un navegador instalado.");
        }
    }

    private void reportError(String message) {
        activity.runOnUiThread(() ->
                Toast.makeText(activity, message, Toast.LENGTH_LONG).show());
    }
}
