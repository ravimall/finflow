
import { useState } from "react";
import { api } from "../lib/api";

const INITIAL_FORM = {
  customer_id: "",
  name: "",
  phone: "",
  email: "",
  address: "",
};

export default function CustomerForm({ onSuccess }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async () => {
    try {
      await api.post("/api/customers", form);
      setForm({ ...INITIAL_FORM });
      onSuccess && onSuccess();
      alert("Customer created");
    } catch (err) {
      alert(err.response?.data?.error || "Error");
    }
  };

  return (
    <div className="space-y-2">
      <input name="customer_id" placeholder="Customer ID" value={form.customer_id} onChange={handle} className="border p-2 w-full"/>
      <input name="name" placeholder="Name" value={form.name} onChange={handle} className="border p-2 w-full"/>
      <input name="phone" placeholder="Phone" value={form.phone} onChange={handle} className="border p-2 w-full"/>
      <input name="email" placeholder="Email" value={form.email} onChange={handle} className="border p-2 w-full"/>
      <textarea name="address" placeholder="Address" value={form.address} onChange={handle} className="border p-2 w-full"/>
      <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded">Create</button>
    </div>
  );
}
