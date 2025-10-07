import CustomerForm from "../components/CustomerForm";
import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

export default function Customers() {
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    axios.get("https://shubhadevelopers.com/api/customers")
      .then(res => setCustomers(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
      <>
    <div className="mb-6"><CustomerForm /></div>
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