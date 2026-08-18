package com.example.mzansiconnect.ui.notifications;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.LinearLayout;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import com.example.mzansiconnect.R;

public class NotificationsFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_notifications, container, false);

        LinearLayout layout = root.findViewById(R.id.recycler_notifications_container);
        if (layout == null) {
            // If I haven't added the container yet, let's fix the layout file too.
            return root;
        }

        addNotification(layout, "ID Application Update", "Your ID application has been received.", "2 hours ago");
        addNotification(layout, "Fine Payment Successful", "Payment for fine #TR9920 has been processed.", "Yesterday");
        addNotification(layout, "Security Alert", "New login detected on Chrome Windows.", "3 days ago");

        return root;
    }

    private void addNotification(LinearLayout container, String title, String body, String time) {
        View view = getLayoutInflater().inflate(android.R.layout.simple_list_item_2, null);
        TextView text1 = view.findViewById(android.R.id.text1);
        TextView text2 = view.findViewById(android.R.id.text2);
        text1.setText(title);
        text2.setText(body + " (" + time + ")");
        container.addView(view);
    }
}