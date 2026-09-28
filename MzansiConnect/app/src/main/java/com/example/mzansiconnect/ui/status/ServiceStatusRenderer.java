package com.example.mzansiconnect.ui.status;

import android.content.Context;
import android.graphics.drawable.GradientDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.util.ServiceData;

/**
 * Renders the live service status board rows (web ServiceStatusBoard.tsx).
 * Reused by the Dashboard embedded section and the dedicated Status tab.
 */
public final class ServiceStatusRenderer {

    private ServiceStatusRenderer() {
    }

    public static void bind(LinearLayout container) {
        if (container == null) {
            return;
        }
        container.removeAllViews();
        Context context = container.getContext();
        LayoutInflater inflater = LayoutInflater.from(context);

        for (ServiceData.ServiceStatus status : ServiceData.SERVICE_STATUS) {
            View row = inflater.inflate(R.layout.item_service_status, container, false);
            ((TextView) row.findViewById(R.id.status_area)).setText(status.area);
            ((TextView) row.findViewById(R.id.status_updated)).setText(status.updated);
            bindChip((TextView) row.findViewById(R.id.status_water),
                    context.getString(R.string.wc_water), status.water, context);
            bindChip((TextView) row.findViewById(R.id.status_power),
                    context.getString(R.string.wc_power), status.power, context);
            container.addView(row);
        }
    }

    private static void bindChip(TextView chip, String label, String state, Context context) {
        String stateLabel;
        int colorRes;
        int bgRes;
        switch (state) {
            case "reduced":
                stateLabel = context.getString(R.string.wc_reduced);
                colorRes = R.color.status_submitted;
                bgRes = R.color.status_submitted_bg;
                break;
            case "outage":
                stateLabel = context.getString(R.string.wc_outage);
                colorRes = R.color.urgency_high;
                bgRes = R.color.status_resolved_bg;
                break;
            default:
                stateLabel = context.getString(R.string.wc_normal);
                colorRes = R.color.status_resolved;
                bgRes = R.color.status_resolved_bg;
                break;
        }
        chip.setText(label + " · " + stateLabel);
        chip.setTextColor(context.getResources().getColor(colorRes));

        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.RECTANGLE);
        bg.setCornerRadius(context.getResources().getDisplayMetrics().density * 12);
        bg.setColor(context.getResources().getColor(bgRes));
        chip.setBackground(bg);
    }
}
