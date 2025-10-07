
import { useState } from "react";
import axios from "axios";

export default function LoanForm({ onSuccess }) {
  const [form, setForm] = useState({ customer_id: "", bank_name: "", applied_amount: "", approved_amount: "", rate_of_interest: "", status: "" });
  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async () => {
    try {
      await axios.post("https://shubhadevelopers.com/api/loans", form);
      onSuccess && onSuccess();
      alert("Loan created");
    } catch (err) {
      alert(err.response?.data?.error || "Error");
    }
  };

  return (
    <div className="space-y-2">
      <input name="customer_id" placeholder="Customer ID" value={form.customer_id} onChange={handle} className="border p-2 w-full"/>
      <input name="bank_name" placeholder="Bank" value={form.bank_name} onChange={handle} className="border p-2 w-full"/>
      <input name="applied_amount" placeholder="Applied Amount" value={form.applied_amount} onChange={handle} className="border p-2 w-full"/>
      <input name="approved_amount" placeholder="Approved Amount" value={form.approved_amount} onChange={handle} className="border p-2 w-full"/>
      <input name="rate_of_interest" placeholder="Rate (%)" value={form.rate_of_interest} onChange={handle} className="border p-2 w-full"/>
      <input name="status" placeholder="Status" value={form.status} onChange={handle} className="border p-2 w-full"/>
      <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded">Create Loan</button>
    </div>
  );
}
