package com.example.mzansiconnect.util;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.appcompat.app.AlertDialog;
import com.example.mzansiconnect.R;

/**
 * Mirrors web Citizen Portal SOSButton.tsx: emergency contacts (Police 10111,
 * Fire 10177, Medical 10177) launched via the dialler.
 */
public final class SosDialog {

    private SosDialog() {
    }

    public static void show(Context context) {
        final String[] labels = {
            context.getString(R.string.wc_police) + " (10111)",
            context.getString(R.string.wc_fire) + " (10177)",
            context.getString(R.string.wc_medical) + " (10177)"
        };
        final String[] numbers = {"10111", "10177", "10177"};

        new AlertDialog.Builder(context)
                .setTitle(context.getString(R.string.wc_sos_title))
                .setMessage(context.getString(R.string.wc_sos_services))
                .setItems(labels, (dialog, which) -> dial(context, numbers[which]))
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    private static void dial(Context context, String number) {
        Intent intent = new Intent(Intent.ACTION_DIAL);
        intent.setData(Uri.parse("tel:" + number));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }
}
