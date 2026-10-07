import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import useHostelPicker from "../../hooks/useHostelPicker";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import StatCard from "../../components/StatCard";
import { Alert, Button, Field, Modal, PageHeader, PageState, Select } from "../../components/ui";
import { money } from "../../utils/format";

const CATS = ["furniture", "electrical", "appliance", "bedding", "plumbing", "cleaning", "other"];
const CONDS = ["new", "good", "fair", "damaged", "under_repair"];

const Inventory = () => {
  const { hostelId, Picker, hostels } = useHostelPicker({ allowAll: true });
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [q, setQ] = useState("");
  const params = new URLSearchParams();
  if (hostelId) params.set("hostel", hostelId);
  if (category) params.set("category", category);
  if (condition) params.set("condition", condition);
  if (q.trim()) params.set("q", q.trim());
  const { data, loading, error, reload } = useFetch(`/inventory?${params}`);
  const summary = useFetch(`/inventory/summary${hostelId ? `?hostel=${hostelId}` : ""}`);
  const [form, setForm] = useState(null);
  const { run, busy, error: formError, setError } = useAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const editing = form && form._id;

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const body = { itemName: form.itemName, category: form.category, quantity: Number(form.quantity), condition: form.condition, purchasePrice: Number(form.purchasePrice) || 0, serialNumber: form.serialNumber, notes: form.notes };
      editing ? await api.put(`/inventory/${form._id}`, body) : await api.post("/inventory", { ...body, hostel: form.hostel });
      setForm(null); reload(); summary.reload();
    });
  };
  const remove = (i) => window.confirm(`Delete ${i.itemName}?`) && run(async () => { await api.delete(`/inventory/${i._id}`); reload(); summary.reload(); });

  const s = summary.data;
  return (
    <div>
      <PageHeader title="Inventory" subtitle="Furniture, appliances and equipment across hostels.">
        {Picker}
        <input className="input !w-40" placeholder="Search item" aria-label="Search items" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={category} onChange={setCategory} placeholder="All categories" options={CATS} />
        <Select value={condition} onChange={setCondition} placeholder="Any condition" options={CONDS} />
        <Button variant="gold" onClick={() => { setError(""); setForm({ hostel: hostelId || hostels[0]?._id || "", itemName: "", category: "furniture", quantity: 1, condition: "good", purchasePrice: 0, serialNumber: "", notes: "" }); }}>+ Add Item</Button>
      </PageHeader>
      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Item types" value={s.totalItems} />
          <StatCard label="Total quantity" value={s.totalQuantity} />
          <StatCard label="Needs attention" value={s.needsAttention} hint="Damaged or under repair" />
          <StatCard label="Estimated value" value={money(s.totalValue)} accent />
        </div>
      )}
      <Alert>{!form && formError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No inventory items yet." columns={[
          { key: "itemName", label: "Item", render: (i) => (<div><p className="font-medium">{i.itemName}</p>{i.serialNumber && <p className="text-xs text-muted">S/N {i.serialNumber}</p>}</div>) },
          { key: "category", label: "Category", render: (i) => <span className="capitalize">{i.category}</span> },
          { key: "quantity", label: "Qty" },
          { key: "condition", label: "Condition", render: (i) => <Badge status={i.condition} /> },
          { key: "hostel", label: "Hostel", render: (i) => i.hostel?.code },
          { key: "purchasePrice", label: "Unit price", render: (i) => money(i.purchasePrice) },
          { key: "act", label: "", render: (i) => (
            <div className="flex gap-2 justify-end"><Button size="sm" variant="outline" onClick={() => { setError(""); setForm({ ...i, hostel: i.hostel?._id }); }}>Edit</Button><Button size="sm" variant="outline" onClick={() => remove(i)}>Delete</Button></div>) },
        ]} />
      </PageState>

      <Modal open={!!form} title={editing ? "Edit item" : "Add item"} onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            {!editing && hostels.length > 1 && <Field label="Hostel"><select className="input" required value={form.hostel} onChange={set("hostel")}>{hostels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}</select></Field>}
            <Field label="Item name"><input className="input" required value={form.itemName} onChange={set("itemName")} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category"><select className="input" value={form.category} onChange={set("category")}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Condition"><select className="input" value={form.condition} onChange={set("condition")}>{CONDS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</select></Field>
              <Field label="Quantity"><input className="input" type="number" min="0" required value={form.quantity} onChange={set("quantity")} /></Field>
              <Field label="Unit price (Rs)"><input className="input" type="number" min="0" value={form.purchasePrice} onChange={set("purchasePrice")} /></Field>
            </div>
            <Field label="Serial number"><input className="input" value={form.serialNumber || ""} onChange={set("serialNumber")} /></Field>
            <Field label="Notes"><input className="input" value={form.notes || ""} onChange={set("notes")} /></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>Save</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default Inventory;
