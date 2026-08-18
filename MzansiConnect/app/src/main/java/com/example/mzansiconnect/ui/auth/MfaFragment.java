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

public class MfaFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_mfa, container, false);

        EditText otpEdit = root.findViewById(R.id.edit_otp);
        Button verifyBtn = root.findViewById(R.id.btn_verify);

        verifyBtn.setOnClickListener(v -> {
            String otp = otpEdit.getText().toString();
            if (otp.length() == 6) {
                Navigation.findNavController(v).navigate(R.id.action_mfa_to_success);
            } else {
                Toast.makeText(getContext(), "Please enter the 6-digit verification code", Toast.LENGTH_SHORT).show();
            }
        });

        return root;
    }
}
