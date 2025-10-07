// import axios from "axios";

export default function Login() {
  const googleLogin = () => {
    window.location.href = "https://shubhadevelopers.com/api/users/google";
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold mb-4">FinFlow Login</h1>
      <button
        onClick={googleLogin}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Sign in with Google
      </button>
    </div>
  );
}