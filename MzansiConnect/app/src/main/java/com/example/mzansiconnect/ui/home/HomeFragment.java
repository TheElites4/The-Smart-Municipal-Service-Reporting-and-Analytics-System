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
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.os.LocaleListCompat;
import androidx.fragment.app.Fragment;
import androidx.navigation.Navigation;
import com.example.mzansiconnect.R;

public class HomeFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_home, container, false);

        Button getStarted = root.findViewById(R.id.btn_get_started);
        View sosCard = root.findViewById(R.id.card_sos);

        getStarted.setOnClickListener(v -> Navigation.findNavController(v).navigate(R.id.navigation_dashboard));

        sosCard.setOnClickListener(v -> {
            Toast.makeText(getContext(), "Opening emergency dialer...", Toast.LENGTH_SHORT).show();
            Intent intent = new Intent(Intent.ACTION_DIAL);
            intent.setData(Uri.parse("tel:10111"));
            startActivity(intent);
        });

        View langEn = root.findViewById(R.id.btn_lang_en);
        View langZu = root.findViewById(R.id.btn_lang_zu);
        View langXh = root.findViewById(R.id.btn_lang_xh);
        View langAf = root.findViewById(R.id.btn_lang_af);

        if (langEn != null) langEn.setOnClickListener(v -> setAppLanguage("en"));
        if (langZu != null) langZu.setOnClickListener(v -> setAppLanguage("zu"));
        if (langXh != null) langXh.setOnClickListener(v -> setAppLanguage("xh"));
        if (langAf != null) langAf.setOnClickListener(v -> setAppLanguage("af"));

        return root;
    }

    private void setAppLanguage(String languageCode) {
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(languageCode));
    }
}
