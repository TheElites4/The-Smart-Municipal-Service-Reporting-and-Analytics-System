package com.example.mzansiconnect.ui.municipality;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.util.Municipalities;
import java.util.ArrayList;
import java.util.List;

/**
 * Municipality directory rows (web MunicipalityDirectory.tsx).
 */
public class MunicipalityAdapter extends RecyclerView.Adapter<MunicipalityAdapter.ViewHolder> {

    private final List<Municipalities.Municipality> items = new ArrayList<>();

    public void submit(List<Municipalities.Municipality> next) {
        items.clear();
        if (next != null) {
            items.addAll(next);
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_municipality, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Municipalities.Municipality item = items.get(position);
        holder.name.setText(item.name);
        holder.meta.setText("\uD83D\uDCCD " + item.province + " · " + item.type);
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {

        final TextView name;
        final TextView meta;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            name = itemView.findViewById(R.id.muni_name);
            meta = itemView.findViewById(R.id.muni_meta);
        }
    }
}
