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
import com.example.mzansiconnect.data.DataRepository;
import com.example.mzansiconnect.data.User;

public class RegistrationFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_registration, container, false);

        EditText nameEdit = root.findViewById(R.id.reg_name);
        EditText idEdit = root.findViewById(R.id.reg_id);
        EditText emailEdit = root.findViewById(R.id.reg_email);
        EditText passEdit = root.findViewById(R.id.reg_pass);
        Button regBtn = root.findViewById(R.id.btn_register);
        View backBtn = root.findViewById(R.id.btn_reg_back);
        View gotoLogin = root.findViewById(R.id.tv_goto_login);

        backBtn.setOnClickListener(v -> Navigation.findNavController(v).navigateUp());
        gotoLogin.setOnClickListener(v -> Navigation.findNavController(v).navigate(R.id.navigation_login));

        regBtn.setOnClickListener(v -> {
            String name = nameEdit.getText().toString();
            String idNum = idEdit.getText().toString();
            String email = emailEdit.getText().toString();
            String pass = passEdit.getText().toString();

            if (name.isEmpty() || idNum.length() != 13 || email.isEmpty() || pass.isEmpty()) {
                Toast.makeText(getContext(), "Please fill all fields (13-digit ID)", Toast.LENGTH_SHORT).show();
                return;
            }

            User user = new User();
            user.fullName = name;
            user.idNumber = idNum;
            user.email = email;
            user.password = pass;

            DataRepository.getInstance(getContext()).registerUser(user, pass);
            Toast.makeText(getContext(), "Registration Successful!", Toast.LENGTH_SHORT).show();
            Navigation.findNavController(v).navigate(R.id.navigation_login);
        });

        return root;
    }
}
