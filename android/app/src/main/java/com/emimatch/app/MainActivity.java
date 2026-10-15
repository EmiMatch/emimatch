package com.emimatch.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private EmiMatchUpdater emiMatchUpdater;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        emiMatchUpdater = new EmiMatchUpdater(this, webView);
        webView.addJavascriptInterface(emiMatchUpdater, "EmiMatchUpdater");
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (emiMatchUpdater != null) {
            emiMatchUpdater.onResume();
        }
    }
}
