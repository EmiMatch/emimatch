package com.emimatch.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        EmiMatchUpdater emiMatchUpdater = new EmiMatchUpdater(this, webView);
        webView.addJavascriptInterface(emiMatchUpdater, "EmiMatchUpdater");
    }
}
