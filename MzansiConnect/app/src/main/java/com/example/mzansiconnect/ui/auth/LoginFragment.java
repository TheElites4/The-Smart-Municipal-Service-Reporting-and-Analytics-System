package com.example.mzansiconnect.ui.auth;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.Navigation;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.DataRepository;
import com.example.mzansiconnect.data.FirebaseManager;

public class LoginFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_login, container, false);

        EditText idEdit = root.findViewById(R.id.login_id);
        EditText passEdit = root.findViewById(R.id.login_pass);
        Button loginBtn = root.findViewById(R.id.btn_login_submit);
        View backBtn = root.findViewById(R.id.btn_login_back);

        backBtn.setOnClickListener(v -> Navigation.findNavController(v).navigateUp());

        loginBtn.setOnClickListener(v -> {
            String email = idEdit.getText().toString().trim();
            String pass = passEdit.getText().toString().trim();

            if (email.isEmpty() || pass.isEmpty()) {
                Toast.makeText(getContext(), "Please enter email and password", Toast.LENGTH_SHORT).show();
                return;
            }

            loginBtn.setEnabled(false);
            if (FirebaseManager.getInstance().getAuth() == null) {
                loginBtn.setEnabled(true);
                Toast.makeText(requireContext(), "Authentication service is unavailable.", Toast.LENGTH_LONG).show();
                return;
            }
            FirebaseManager.getInstance().getAuth().signInWithEmailAndPassword(email, pass)
                    .addOnSuccessListener(result -> {
                        if (isAdded()) {
                            DataRepository.getInstance(requireContext()).syncFcmTokenToFirebase();
                            Navigation.findNavController(v).navigate(R.id.action_login_to_mfa);
                        }
                    })
                    .addOnFailureListener(error -> {
                        if (!isAdded()) return;
                        loginBtn.setEnabled(true);
                        Toast.makeText(requireContext(), "Sign in failed: " + error.getLocalizedMessage(), Toast.LENGTH_LONG).show();
                    });
        });

        return root;
    }
}
