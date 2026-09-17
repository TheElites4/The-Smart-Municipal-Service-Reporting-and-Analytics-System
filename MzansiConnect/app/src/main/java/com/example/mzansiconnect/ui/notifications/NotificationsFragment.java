package com.example.mzansiconnect.ui.notifications;

import android.os.Bundle;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.FirebaseManager;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.ListenerRegistration;
import java.util.Date;

public class NotificationsFragment extends Fragment {

    private ListenerRegistration notificationsListener;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_notifications, container, false);

        LinearLayout layout = root.findViewById(R.id.recycler_notifications_container);
        if (layout == null) {
            return root;
        }

        addNotification(layout, "ID Application Update", "Your ID application has been received.", "2 hours ago");
        addNotification(layout, "Fine Payment Successful", "Payment for fine #TR9920 has been processed.", "Yesterday");
        addNotification(layout, "Security Alert", "New login detected on Chrome Windows.", "3 days ago");

        // Real-time Cloud Firestore Listener for Notifications
        FirebaseManager fm = FirebaseManager.getInstance();
        if (fm.getFirestore() != null) {
            notificationsListener = fm.getFirestore().collection("notifications")
                    .addSnapshotListener((snapshots, e) -> {
                        if (e != null) {
                            Log.e("NotificationsFragment", "Listen failed: " + e.getMessage());
                            return;
                        }
                        if (snapshots != null && !snapshots.isEmpty() && isAdded()) {
                            for (DocumentSnapshot doc : snapshots.getDocuments()) {
                                String title = doc.getString("title");
                                String body = doc.getString("body");
                                if (title != null && body != null) {
                                    addNotification(layout, title, body, "Just now");
                                }
                            }
                        }
                    });
        }

        return root;
    }

    private void addNotification(LinearLayout container, String title, String body, String time) {
        if (!isAdded()) return;
        View view = getLayoutInflater().inflate(android.R.layout.simple_list_item_2, null);
        TextView text1 = view.findViewById(android.R.id.text1);
        TextView text2 = view.findViewById(android.R.id.text2);
        text1.setText(title);
        text2.setText(body + " (" + time + ")");
        container.addView(view);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (notificationsListener != null) {
            notificationsListener.remove();
        }
    }
}
