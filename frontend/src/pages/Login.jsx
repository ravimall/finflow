// import axios from "axios";
import { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { AuthContext } from "../context/AuthContext";

export default function Login() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const googleLogin = () => {
    window.location.href = `${API_BASE_URL}/api/users/google`;
  };

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">FinFlow Login</h1>
        <p className="mt-2 text-sm text-gray-500 md:text-base">
          Continue with your Google workspace account to access FinFlow.
        </p>
        <button
          onClick={googleLogin}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Sign in with Google
        </button>
      </div>
    </section>
  );
}

