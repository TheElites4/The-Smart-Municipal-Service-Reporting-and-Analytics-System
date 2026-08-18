package com.example.mzansiconnect.ui.home;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.Navigation;
import com.example.mzansiconnect.R;

public class HomeFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_home, container, false);

        Button getStarted = root.findViewById(R.id.btn_get_started);
        Button login = root.findViewById(R.id.btn_home_login);
        View sosCard = root.findViewById(R.id.card_sos);

        getStarted.setOnClickListener(v -> Navigation.findNavController(v).navigate(R.id.navigation_registration));
        login.setOnClickListener(v -> Navigation.findNavController(v).navigate(R.id.navigation_login));

        sosCard.setOnClickListener(v -> {
            Toast.makeText(getContext(), "Connecting to Emergency Services...", Toast.LENGTH_SHORT).show();
            Intent intent = new Intent(Intent.ACTION_DIAL);
            intent.setData(Uri.parse("tel:10111"));
            startActivity(intent);
        });

        return root;
    }
}
