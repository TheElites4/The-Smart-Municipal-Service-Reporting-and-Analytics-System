package com.example.mzansiconnect.ui.auth;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.Navigation;

import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.FirebaseManager;
import com.google.firebase.FirebaseException;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException;
import com.google.firebase.auth.PhoneAuthCredential;
import com.google.firebase.auth.PhoneAuthOptions;
import com.google.firebase.auth.PhoneAuthProvider;

import java.util.concurrent.TimeUnit;

/**
 * Real second-factor verification using Firebase Phone Authentication.
 *
 * The sign-in step already proved the password. This screen proves control of
 * the user's phone number: Firebase sends an SMS code, the user types it, and
 * Firebase returns a credential only when the code matches. A code is accepted
 * ONLY after Firebase confirms it - never by a local length check.
 */
public class MfaFragment extends Fragment {

    private EditText phoneEdit;
    private EditText otpEdit;
    private Button sendBtn;
    private Button verifyBtn;
    private TextView resendBtn;

    private FirebaseAuth auth;
    private String verificationId;
    private PhoneAuthProvider.ForceResendingToken resendToken;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_mfa, container, false);

        phoneEdit = root.findViewById(R.id.edit_phone);
        otpEdit = root.findViewById(R.id.edit_otp);
        sendBtn = root.findViewById(R.id.btn_send_code);
        verifyBtn = root.findViewById(R.id.btn_verify);
        resendBtn = root.findViewById(R.id.btn_resend);

        auth = FirebaseManager.getInstance().getAuth();
        if (auth == null) {
            toast("Authentication service is unavailable.");
        }

        sendBtn.setOnClickListener(v -> startPhoneVerification(false));
        resendBtn.setOnClickListener(v -> startPhoneVerification(true));
        verifyBtn.setOnClickListener(v -> submitCode());

        return root;
    }

    private void startPhoneVerification(boolean isResend) {
        if (auth == null) {
            toast("Authentication service is unavailable.");
            return;
        }
        String phone = phoneEdit.getText().toString().trim().replaceAll("[^+\\d]", "");
        if (!phone.matches("^\\+[1-9]\\d{7,14}$")) {
            toast("Enter the phone number in international format, e.g. +27821234567.");
            return;
        }

        sendBtn.setEnabled(false);
        resendBtn.setEnabled(false);

        PhoneAuthOptions.Builder builder = PhoneAuthOptions.newBuilder(auth)
                .setPhoneNumber(phone)
                .setTimeout(60L, TimeUnit.SECONDS)
                .setActivity(requireActivity())
                .setCallbacks(new PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                    @Override
                    public void onVerificationCompleted(@NonNull PhoneAuthCredential credential) {
                        // Instant verification (a test number or auto-retrieval):
                        // Firebase already proved the number, so sign in immediately.
                        completeSignIn(credential);
                    }

                    @Override
                    public void onVerificationFailed(@NonNull FirebaseException e) {
                        if (!isAdded()) return;
                        sendBtn.setEnabled(true);
                        resendBtn.setEnabled(true);
                        toast("Verification failed: " + e.getLocalizedMessage());
                    }

                    @Override
                    public void onCodeSent(@NonNull String id, @NonNull PhoneAuthProvider.ForceResendingToken token) {
                        if (!isAdded()) return;
                        verificationId = id;
                        resendToken = token;
                        sendBtn.setEnabled(true);
                        resendBtn.setEnabled(true);
                        sendBtn.setText("Code sent");
                        otpEdit.requestFocus();
                        toast("A 6-digit code was sent to " + phone);
                    }
                });

        if (isResend && resendToken != null) {
            builder.setForceResendingToken(resendToken);
        }
        PhoneAuthProvider.verifyPhoneNumber(builder.build());
    }

    private void submitCode() {
        if (auth == null) {
            toast("Authentication service is unavailable.");
            return;
        }
        String code = otpEdit.getText().toString().trim();
        if (verificationId == null) {
            toast("Send a code to your phone first.");
            return;
        }
        if (code.length() != 6) {
            toast("Please enter the 6-digit verification code");
            return;
        }

        verifyBtn.setEnabled(false);
        PhoneAuthCredential credential = PhoneAuthProvider.getCredential(verificationId, code);
        completeSignIn(credential);
    }

    private void completeSignIn(PhoneAuthCredential credential) {
        if (auth == null || !isAdded()) return;
        auth.signInWithCredential(credential)
                .addOnSuccessListener(result -> {
                    View view = getView();
                    if (view != null) {
                        Navigation.findNavController(view).navigate(R.id.action_mfa_to_success);
                    }
                })
                .addOnFailureListener(error -> {
                    if (!isAdded()) return;
                    verifyBtn.setEnabled(true);
                    String message = error instanceof FirebaseAuthInvalidCredentialsException
                            ? "That code is incorrect or expired. Try again or resend."
                            : "Verification failed: " + error.getLocalizedMessage();
                    toast(message);
                });
    }

    private void toast(String message) {
        if (isAdded() && getContext() != null) {
            Toast.makeText(getContext(), message, Toast.LENGTH_LONG).show();
        }
    }
}
