package com.example.mzansiconnect.data;

import android.util.Log;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.database.FirebaseDatabase;

public class FirebaseManager {
    private static FirebaseManager instance;
    private FirebaseAuth auth;
    private FirebaseFirestore firestore;
    private FirebaseDatabase database;

    private FirebaseManager() {
        try {
            auth = FirebaseAuth.getInstance();
            firestore = FirebaseFirestore.getInstance();
            database = FirebaseDatabase.getInstance();
        } catch (Exception e) {
            Log.e("FirebaseManager", "Firebase initialization failed: " + e.getMessage());
        }
    }

    public static synchronized FirebaseManager getInstance() {
        if (instance == null) {
            instance = new FirebaseManager();
        }
        return instance;
    }

    public FirebaseAuth getAuth() { return auth; }
    public FirebaseFirestore getFirestore() { return firestore; }
    public FirebaseDatabase getDatabase() { return database; }
}
