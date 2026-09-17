package com.example.mzansiconnect.data;

import android.util.Log;
import androidx.annotation.NonNull;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.messaging.FirebaseMessaging;

public class FirebaseManager {
    private static final String TAG = "FirebaseManager";
    private static FirebaseManager instance;
    private FirebaseAuth auth;
    private FirebaseFirestore firestore;
    private FirebaseDatabase database;
    private FirebaseMessaging messaging;

    public interface FcmTokenCallback {
        void onTokenReceived(String token);
        void onError(Exception e);
    }

    private FirebaseManager() {
        try {
            auth = FirebaseAuth.getInstance();
            firestore = FirebaseFirestore.getInstance();
            database = FirebaseDatabase.getInstance();
            messaging = FirebaseMessaging.getInstance();
            
            // Initialize Cloud Messaging global topics
            subscribeToTopic("all_citizens");
            subscribeToTopic("emergency_alerts");
        } catch (Exception e) {
            Log.e(TAG, "Firebase initialization failed: " + e.getMessage());
        }
    }

    public static synchronized FirebaseManager getInstance() {
        if (instance == null) {
            instance = new FirebaseManager();
        }
        return instance;
    }

    // --- Authentication ---
    public FirebaseAuth getAuth() { return auth; }

    public FirebaseUser getCurrentUser() {
        return auth != null ? auth.getCurrentUser() : null;
    }

    public boolean isLoggedIn() {
        return getCurrentUser() != null;
    }

    public String getCurrentUserId() {
        FirebaseUser user = getCurrentUser();
        return user != null ? user.getUid() : null;
    }

    public void signOut() {
        if (auth != null) {
            auth.signOut();
        }
    }

    // --- Cloud Firestore ---
    public FirebaseFirestore getFirestore() { return firestore; }

    // --- Realtime Database ---
    public FirebaseDatabase getDatabase() { return database; }

    // --- Cloud Messaging (FCM) ---
    public FirebaseMessaging getMessaging() { return messaging; }

    public void subscribeToTopic(String topic) {
        if (messaging != null) {
            messaging.subscribeToTopic(topic)
                    .addOnCompleteListener(task -> {
                        if (task.isSuccessful()) {
                            Log.d(TAG, "Subscribed to FCM topic: " + topic);
                        } else {
                            Log.e(TAG, "Failed to subscribe to FCM topic: " + topic, task.getException());
                        }
                    });
        }
    }

    public void fetchFcmToken(FcmTokenCallback callback) {
        if (messaging == null) {
            if (callback != null) callback.onError(new IllegalStateException("Firebase Messaging is unavailable."));
            return;
        }

        messaging.getToken().addOnCompleteListener(new OnCompleteListener<String>() {
            @Override
            public void onComplete(@NonNull Task<String> task) {
                if (task.isSuccessful() && task.getResult() != null) {
                    String token = task.getResult();
                    Log.d(TAG, "FCM Registration Token: " + token);
                    if (callback != null) callback.onTokenReceived(token);
                } else {
                    Log.e(TAG, "Fetching FCM registration token failed", task.getException());
                    if (callback != null) callback.onError(task.getException());
                }
            }
        });
    }
}
