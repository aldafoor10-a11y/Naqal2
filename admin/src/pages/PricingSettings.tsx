import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchPricingSettings, updatePricingSettings } from '../api';
import { DollarSign, Save, Loader2, Settings } from 'lucide-react';

function fmtIQD(v: number) { return (v || 0).toLocaleString('en-US') + ' IQD'; }

export default function PricingSettings() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['pricing-settings'],
    queryFn: fetchPricingSettings,
  });
  const [form, setForm] = useState<any>({});
  const [saved, setSaved] = useState(false);

  // Initialise form once settings load
  if (settings && Object.keys(form).length === 0) {
    setForm({
      min_price: settings.min_price ?? 8000,
      max_auto_price: settings.max_auto_price ?? 75000,
      auto_cap_distance_km: settings.auto_cap_distance_km ?? 75,
      manual_review_distance_km: settings.manual_review_distance_km ?? 130,
      peak_multiplier: settings.peak_multiplier ?? 1.15,
    });
  }

  const save = useMutation({
    mutationFn: (payload: any) => updatePricingSettings(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (isLoading) return <div className="p-8 text-muted">Loading...</div>;

  const Field = ({ label, name, suffix, step = 1 }: any) => (
    <div>
      <label className="text-sm text-muted mb-1 block">{label}</label>
      <div className="relative">
        <input
          className="input pr-16"
          type="number"
          step={step}
          value={form[name] ?? ''}
          onChange={(e) => setForm({ ...form, [name]: parseFloat(e.target.value) || 0 })}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gold/15 text-gold flex items-center justify-center">
            <Settings size={22} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Pricing Settings</h1>
            <p className="text-muted">Modify automatic pricing rules. Changes apply immediately to new orders.</p>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Minimum price" name="min_price" suffix="IQD" step={500} />
          <Field label="Max auto price (cap)" name="max_auto_price" suffix="IQD" step={1000} />
          <Field label="Auto cap distance" name="auto_cap_distance_km" suffix="km" />
          <Field label="Manual review above" name="manual_review_distance_km" suffix="km" />
          <Field label="Peak hours multiplier" name="peak_multiplier" suffix="x" step={0.05} />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-xs text-muted">
            Last updated: {settings?.updated_at ? new Date(settings.updated_at).toLocaleString() : '—'}
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="text-ok text-sm">✓ Saved</span>}
            <button className="btn-primary flex items-center gap-2" onClick={() => save.mutate(form)} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 card p-4 text-sm text-muted bg-info/5 border-info/30">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign size={16} className="text-info" />
          <span className="font-semibold text-info">How pricing works</span>
        </div>
        Customers see an automatically calculated price based on distance and vehicle type. For orders above the
        manual review distance ({form.manual_review_distance_km || '130'} km), the price is set to 0 and the order
        is sent to the Pricing Review queue for manual approval. You can also override individual order prices.
      </div>
    </div>
  );
}
