import CustomerForm from "../components/CustomerForm";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function Customers() {
  const [customers, setCustomers] = useState([]);

  const fetchCustomers = useCallback(() => {
    api
      .get("/api/customers")
      .then((res) => setCustomers(res.data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return (
    <>
      <div className="mb-6">
        <CustomerForm onSuccess={fetchCustomers} />
      </div>
      <div>
        <h1 className="text-xl font-bold mb-4">Customers</h1>
        <ul>
          {customers.map(c => (
            <li key={c.id}>
              <Link to={`/customers/${c.id}`} className="text-blue-600 underline">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

