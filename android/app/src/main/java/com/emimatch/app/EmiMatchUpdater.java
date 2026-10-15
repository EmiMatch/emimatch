package com.emimatch.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONObject;

/**
 * Downloads the official EmiMatch APK without opening a browser.
 * Android's package installer still asks the user to confirm installation.
 */
public final class EmiMatchUpdater {
    private static final String APK_URL =
            "https://github.com/EmiMatch/emimatch/releases/latest/download/app-release.apk";
    private static final String PREFS = "emimatch_updater";
    private static final String KEY_ACTIVE_DOWNLOAD = "active_download_id";
    private static final String KEY_PENDING_INSTALL = "pending_install_id";

    private final Activity activity;
    private final WebView webView;
    private final DownloadManager downloadManager;
    private final android.content.SharedPreferences preferences;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private long downloadId = -1L;
    private boolean completionHandled = false;

    public EmiMatchUpdater(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.downloadManager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
        this.preferences = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @JavascriptInterface
    public void downloadAndInstall() {
        activity.runOnUiThread(this::startDownload);
    }

    public void onResume() {
        long pendingInstall = preferences.getLong(KEY_PENDING_INSTALL, -1L);
        if (pendingInstall >= 0 && canInstallPackages()) {
            launchInstaller(pendingInstall);
            return;
        }

        long activeDownload = preferences.getLong(KEY_ACTIVE_DOWNLOAD, -1L);
        if (activeDownload >= 0) {
            downloadId = activeDownload;
            completionHandled = false;
            pollDownload();
        }
    }

    private void startDownload() {
        if (downloadManager == null) {
            reportError("No se pudo iniciar la descarga. Intentá nuevamente.");
            return;
        }

        long activeDownload = preferences.getLong(KEY_ACTIVE_DOWNLOAD, -1L);
        if (activeDownload >= 0 && isDownloadActiveOrComplete(activeDownload)) {
            downloadId = activeDownload;
            completionHandled = false;
            reportProgress(0, "La descarga ya está en curso...");
            pollDownload();
            return;
        }

        try {
            Uri uri = Uri.parse(APK_URL);
            DownloadManager.Request request = new DownloadManager.Request(uri);
            request.setTitle("Actualización de EmiMatch");
            request.setDescription("Descargando la nueva versión de EmiMatch");
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(false);
            request.setDestinationInExternalFilesDir(
                    activity, Environment.DIRECTORY_DOWNLOADS, "emimatch-update.apk");

            downloadId = downloadManager.enqueue(request);
            completionHandled = false;
            preferences.edit().putLong(KEY_ACTIVE_DOWNLOAD, downloadId).apply();
            reportProgress(0, "Iniciando descarga segura...");
            pollDownload();
        } catch (Exception exception) {
            reportError("No se pudo iniciar la descarga. Revisá tu conexión e intentá otra vez.");
        }
    }

    private boolean isDownloadActiveOrComplete(long id) {
        try (Cursor cursor = downloadManager.query(new DownloadManager.Query().setFilterById(id))) {
            if (cursor == null || !cursor.moveToFirst()) return false;
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            return status == DownloadManager.STATUS_PENDING
                    || status == DownloadManager.STATUS_RUNNING
                    || status == DownloadManager.STATUS_PAUSED
                    || status == DownloadManager.STATUS_SUCCESSFUL;
        } catch (Exception exception) {
            return false;
        }
    }

    private void pollDownload() {
        if (downloadId < 0 || completionHandled) return;

        try (Cursor cursor = downloadManager.query(new DownloadManager.Query().setFilterById(downloadId))) {
            if (cursor == null || !cursor.moveToFirst()) {
                failDownload("No se encontró la descarga. Tocá Actualizar ahora para reintentar.");
                return;
            }

            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));

            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                finishDownload(downloadId);
                return;
            }
            if (status == DownloadManager.STATUS_FAILED) {
                failDownload("La descarga falló. Revisá tu conexión e intentá nuevamente.");
                return;
            }

            int percent = total > 0 ? (int) Math.min(99, (downloaded * 100L) / total) : 0;
            String message = status == DownloadManager.STATUS_PAUSED
                    ? "Descarga pausada; esperando conexión..."
                    : "Descargando actualización...";
            reportProgress(percent, message);
            handler.postDelayed(this::pollDownload, 500);
        } catch (Exception exception) {
            failDownload("No se pudo comprobar la descarga. Intentá nuevamente.");
        }
    }

    private void finishDownload(long id) {
        if (completionHandled) return;
        completionHandled = true;
        handler.removeCallbacksAndMessages(null);
        preferences.edit()
                .remove(KEY_ACTIVE_DOWNLOAD)
                .putLong(KEY_PENDING_INSTALL, id)
                .apply();
        reportProgress(100, "Descarga completa. Preparando la instalación...");
        if (canInstallPackages()) {
            launchInstaller(id);
        } else {
            Toast.makeText(activity,
                    "La descarga terminó. Permití instalar aplicaciones para EmiMatch; al volver se abrirá el instalador.",
                    Toast.LENGTH_LONG).show();
            try {
                Intent settingsIntent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName()));
                settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(settingsIntent);
            } catch (Exception exception) {
                reportError("La descarga terminó, pero Android requiere habilitar la instalación de EmiMatch en Ajustes.");
            }
        }
    }

    private boolean canInstallPackages() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || activity.getPackageManager().canRequestPackageInstalls();
    }

    private void launchInstaller(long id) {
        try {
            Uri apkUri = downloadManager.getUriForDownloadedFile(id);
            if (apkUri == null) {
                preferences.edit().remove(KEY_PENDING_INSTALL).apply();
                reportError("No se encontró el APK descargado. Tocá Actualizar ahora para reintentar.");
                return;
            }

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(installIntent);
            preferences.edit().remove(KEY_PENDING_INSTALL).apply();
        } catch (Exception exception) {
            preferences.edit().putLong(KEY_PENDING_INSTALL, id).apply();
            reportError("Android no pudo abrir el instalador. Revisá los permisos de instalación e intentá otra vez.");
        }
    }

    private void failDownload(String message) {
        completionHandled = true;
        handler.removeCallbacksAndMessages(null);
        preferences.edit().remove(KEY_ACTIVE_DOWNLOAD).apply();
        reportError(message);
    }

    private void reportProgress(int percent, String message) {
        String safeMessage = JSONObject.quote(message);
        String script = "if(window.EmiMatchUpdateProgress){window.EmiMatchUpdateProgress("
                + percent + "," + safeMessage + ");}";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void reportError(String message) {
        Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
        reportProgress(-1, message);
    }
}
