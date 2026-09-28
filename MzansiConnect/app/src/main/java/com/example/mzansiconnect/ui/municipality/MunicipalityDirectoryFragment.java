package com.example.mzansiconnect.ui.municipality;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.util.Municipalities;
import java.util.List;

/**
 * Mirrors web MunicipalityDirectory.tsx with live search.
 */
public class MunicipalityDirectoryFragment extends Fragment {

    private MunicipalityAdapter adapter;
    private TextView emptyView;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_municipality_directory, container, false);

        RecyclerView recycler = root.findViewById(R.id.recycler_municipalities);
        emptyView = root.findViewById(R.id.municipality_empty);
        EditText search = root.findViewById(R.id.edit_municipality_search);

        recycler.setLayoutManager(new LinearLayoutManager(getContext()));
        adapter = new MunicipalityAdapter();
        recycler.setAdapter(adapter);

        applyFilter("");
        search.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int a, int b, int c) {
            }

            @Override
            public void onTextChanged(CharSequence s, int a, int b, int c) {
            }

            @Override
            public void afterTextChanged(Editable s) {
                applyFilter(s.toString());
            }
        });

        return root;
    }

    private void applyFilter(String query) {
        List<Municipalities.Municipality> results = Municipalities.search(query);
        adapter.submit(results);
        emptyView.setVisibility(results.isEmpty() ? View.VISIBLE : View.GONE);
    }
}
