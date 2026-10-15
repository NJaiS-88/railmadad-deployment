import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Phone,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { staffClient } from "../api/staffClient";

export default function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("9876543210");
  const [password, setPassword] = useState("1234");
  const [loginMode, setLoginMode] = useState("otp"); // 'otp' or 'password'
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);

  const handleSendOtp = () => {
    if (!phone || phone.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setError("");
    setOtpSent(true);
    setTimer(30);
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone) {
      setError("Phone number is required.");
      return;
    }
    if (!password) {
      setError(
        loginMode === "otp" ? "OTP code is required." : "Password is required.",
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const staff = await staffClient.loginStaff(phone, password);
      onLoginSuccess(staff);
      navigate("/");
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col justify-between bg-white px-6 py-8 select-none">
      {/* Brand Header */}
      <div className="flex flex-col items-center mt-6 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl p-2.5 shadow-md border border-slate-150 flex items-center justify-center overflow-hidden mb-4 animate-bounce">
          <img
            src="/logo.png"
            alt="Rail Madad Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h2 className="text-xl font-black text-[#004696] tracking-wider block font-sans">
          RAIL MADAD
        </h2>
        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">
          Field Staff Portal
        </p>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4 my-8">
        {/* Error Notification */}
        {error && (
          <div className="flex items-start space-x-2 bg-red-50 border border-red-200 text-danger-red p-3 rounded-xl text-xs font-semibold animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Input Mobile */}
        <div className="flex flex-col space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Mobile Number
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Phone className="w-4 h-4" />
            </span>
            <input
              type="tel"
              maxLength="10"
              placeholder="Enter 10-digit mobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-rail-blue rounded-xl pl-9 pr-4 py-3 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition"
              required
            />
          </div>
        </div>

        {/* Auth Mode Toggle */}
        <div className="flex bg-slate-100 rounded-xl p-1 text-xs font-bold text-slate-700">
          <button
            type="button"
            onClick={() => {
              setLoginMode("otp");
              setPassword("1234");
              setError("");
            }}
            className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer ${
              loginMode === "otp"
                ? "bg-white shadow text-rail-blue"
                : "hover:bg-slate-200"
            }`}
          >
            OTP Login
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("password");
              setPassword("");
              setError("");
            }}
            className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer ${
              loginMode === "password"
                ? "bg-white shadow text-rail-blue"
                : "hover:bg-slate-200"
            }`}
          >
            Password
          </button>
        </div>

        {/* Input Security Code */}
        {loginMode === "otp" ? (
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                One Time Password (OTP)
              </label>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={timer > 0}
                className={`text-[10px] font-bold uppercase transition ${
                  timer > 0
                    ? "text-slate-400"
                    : "text-rail-blue hover:text-blue-700 cursor-pointer"
                }`}
              >
                {timer > 0 ? `Resend in ${timer}s` : "Request OTP"}
              </button>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                maxLength="6"
                placeholder={
                  otpSent
                    ? "Enter 4-digit OTP (e.g. 1234)"
                    : "Request OTP to receive code"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-rail-blue rounded-xl pl-9 pr-4 py-3 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition"
                required
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Account Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-rail-blue rounded-xl pl-9 pr-10 py-3 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-rail-blue hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center space-x-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Verify & Log In</span>
            </>
          )}
        </button>
      </form>

      <div className="text-center">
        <p className="text-xs text-muted-text font-medium">
          New to Rail Madad?{" "}
          <Link
            to="/register"
            className="text-rail-blue hover:underline font-bold"
          >
            Register Staff Account
          </Link>
        </p>
      </div>
    </div>
  );
}
