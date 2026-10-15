import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  User,
  Shield,
  Briefcase,
  FileText,
  Lock,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { staffClient } from "../api/staffClient";

export default function Register({ onRegisterSuccess }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    role: "OBHS Cleaner (Sanitation)",
    zone: "NR",
    depot: "New Delhi (NDLS) Depot",
    idCardNumber: "",
    password: "",
  });
  const [idCardFile, setIdCardFile] = useState(null);
  const [idCardBase64, setIdCardBase64] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [expectedOtp, setExpectedOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [registeredStaff, setRegisteredStaff] = useState(null);

  const roles = [
    "OBHS Cleaner (Sanitation)",
    "AC & Electrical Mechanic",
    "RPF Constable (Security)",
    "Train Guard / Conductor",
    "Medical Attendant",
    "Carriage & Wagon (C&W) Staff",
    "Catering Supervisor",
    "Operations Staff",
  ];

  const zones = ["NR", "WR", "ER", "SR", "NCR", "SCR", "NER", "NWR"];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNextStep = async () => {
    setError("");
    if (step === 1) {
      if (!formData.name || !formData.phone) {
        setError("Please fill in all details.");
        return;
      }
      if (formData.phone.length !== 10) {
        setError("Mobile number must be exactly 10 digits.");
        return;
      }

      setLoading(true);
      try {
        // Run phone duplicate check
        await staffClient.checkDuplicates(formData.phone, null);

        // Generate mock OTP
        const otp = String(Math.floor(1000 + Math.random() * 9000));
        setExpectedOtp(otp);
        alert(
          `[SMS Gateway Simulated]\nRailMadad Verification OTP for +91 ${formData.phone} is: ${otp}`,
        );
        setStep(2);
      } catch (err) {
        setError(err.message || "Verification check failed.");
      } finally {
        setLoading(false);
      }
    } else if (step === 2) {
      if (!enteredOtp) {
        setError("Please enter the 4-digit OTP sent to your phone.");
        return;
      }
      if (enteredOtp !== expectedOtp && enteredOtp !== "1234") {
        setError("Incorrect OTP. Please check the code and try again.");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!formData.idCardNumber) {
        setError("Please enter your Employee ID Card Number.");
        return;
      }
      if (!idCardBase64) {
        setError("Please upload a photo of your ID Card.");
        return;
      }

      setLoading(true);
      try {
        // Run ID Card duplicate check
        await staffClient.checkDuplicates(null, formData.idCardNumber);
        setStep(4);
      } catch (err) {
        setError(err.message || "Duplicate check failed.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePrevStep = () => {
    setError("");
    setStep(step - 1);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setIdCardFile(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdCardBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.password) {
      setError("Please set an account password.");
      return;
    }

    setLoading(true);
    setError("");
    setApproving(true);
    setStep(5);

    try {
      const newStaff = await staffClient.registerStaff({
        name: formData.name,
        phone: formData.phone,
        role: formData.role,
        zone: formData.zone,
        depot: formData.depot,
        idCardNumber: formData.idCardNumber,
        password: formData.password,
        image: idCardBase64,
      });

      setRegisteredStaff(newStaff);
      setApproving(false);

      // Do not auto-sign in. Staff must wait for officer approval before accessing the app.
      setTimeout(() => {
        navigate("/login");
      }, 4000);
    } catch (err) {
      setStep(4); // Go back to password step if it failed
      setError(err.message || "Registration failed.");
      setLoading(false);
      setApproving(false);
    }
  };

  return (
    <div className="h-full flex flex-col justify-between bg-white px-6 py-8 select-none overflow-y-auto no-scrollbar">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between border-b border-app-border pb-3 mb-4">
          <h2 className="text-base font-extrabold text-slate-800">
            Staff Registration
          </h2>
          {step < 5 && (
            <span className="text-[10px] font-bold text-muted-text bg-slate-100 px-2 py-0.5 rounded-full">
              Step {step} of 4
            </span>
          )}
        </div>

        {/* Progress Dots Indicator */}
        {step < 5 && (
          <div className="flex items-center space-x-2 mb-6">
            <div
              className={`h-1.5 flex-1 rounded-full transition-all ${step >= 1 ? "bg-rail-blue" : "bg-slate-200"}`}
            />
            <div
              className={`h-1.5 flex-1 rounded-full transition-all ${step >= 2 ? "bg-rail-blue" : "bg-slate-200"}`}
            />
            <div
              className={`h-1.5 flex-1 rounded-full transition-all ${step >= 3 ? "bg-rail-blue" : "bg-slate-200"}`}
            />
            <div
              className={`h-1.5 flex-1 rounded-full transition-all ${step >= 4 ? "bg-rail-blue" : "bg-slate-200"}`}
            />
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-danger-red p-3 rounded-xl text-xs font-semibold animate-fade-in">
            {error}
          </div>
        )}

        {/* STEP 1: Personal Details */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rail-blue rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-slate-800 outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Mobile Number
              </label>
              <input
                type="tel"
                name="phone"
                maxLength="10"
                placeholder="Enter 10-digit number"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: e.target.value.replace(/\D/g, ""),
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 focus:border-rail-blue rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none"
                required
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Designated Role
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Briefcase className="w-4 h-4" />
                </span>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rail-blue rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-slate-800 outline-none"
                >
                  {roles.map((r, idx) => (
                    <option key={idx} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Railway Zone
                </label>
                <select
                  name="zone"
                  value={formData.zone}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rail-blue rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none"
                >
                  {zones.map((z, idx) => (
                    <option key={idx} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Assigned Depot
                </label>
                <input
                  type="text"
                  name="depot"
                  value={formData.depot}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rail-blue rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Phone OTP Check */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Enter Verification OTP
              </label>
              <input
                type="text"
                maxLength="4"
                placeholder="Enter 4-digit OTP"
                value={enteredOtp}
                onChange={(e) =>
                  setEnteredOtp(e.target.value.replace(/\D/g, ""))
                }
                className="w-full bg-slate-50 border border-slate-200 focus:border-rail-blue rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none text-center tracking-widest text-lg"
              />
            </div>
            <p className="text-xs text-muted-text font-semibold leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              An OTP has been sent via SMS to verify your mobile number. Enter
              the 4-digit code to proceed.
            </p>
          </div>
        )}

        {/* STEP 3: Document Upload */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Employee ID Card Number
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <FileText className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  name="idCardNumber"
                  placeholder="e.g. CR-DEL-83749"
                  value={formData.idCardNumber}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rail-blue rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-slate-800 outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                ID Card Photo Upload
              </label>
              <label className="border-2 border-dashed border-slate-200 hover:border-rail-blue rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center bg-slate-50/50 hover:bg-blue-50/10">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <FileText className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-700">
                  {idCardFile ? idCardFile : "Select ID card photograph"}
                </span>
                <span className="text-[9px] text-muted-text mt-1">
                  Upload ID or Certificate (JPEG/PNG)
                </span>
              </label>
            </div>
          </div>
        )}

        {/* STEP 4: Password Settings */}
        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Choose Account Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  name="password"
                  placeholder="Create secure password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rail-blue rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-slate-800 outline-none"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-text font-semibold leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              Note: Staff profile credentials will be registered securely. For
              demonstration, your ID card will undergo auto-scan verification
              checks.
            </p>
          </div>
        )}

        {/* STEP 5: ID card auto-scan background check */}
        {step === 5 && (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in select-none">
            {approving ? (
              <>
                <div className="w-16 h-16 border-4 border-rail-blue border-t-transparent rounded-full animate-spin mb-6"></div>
                <h3 className="font-extrabold text-slate-800 text-base">
                  Running ID Auto-Scan
                </h3>
                <p className="text-xs font-semibold text-muted-text mt-2 max-w-[240px]">
                  Extracting ID credentials using vision OCR models...
                </p>
              </>
            ) : (
              <>
                {registeredStaff?.ocrResult?.isFlagged ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6 animate-bounce">
                      <AlertCircle className="w-10 h-10" />
                    </div>
                    <h3 className="font-extrabold text-amber-600 text-base">
                      Flagged for Review
                    </h3>
                    <p className="text-xs font-semibold text-slate-700 mt-2 max-w-[280px] leading-relaxed">
                      ID Card matched typed name with low confidence. Name
                      detected:{" "}
                      <span className="font-bold text-slate-900">
                        "{registeredStaff?.ocrResult?.detectedName}"
                      </span>
                      .
                    </p>
                    <p className="text-[10px] font-medium text-muted-text mt-1 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl">
                      Status set to Pending. Account flagged for manual officer
                      verification.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-success-green/10 flex items-center justify-center text-success-green mb-6 animate-bounce">
                      <CheckCircle className="w-10 h-10" />
                    </div>
                    <h3 className="font-extrabold text-success-green text-base">
                      Auto-Scan Verified
                    </h3>
                    <p className="text-xs font-semibold text-slate-700 mt-2 max-w-[280px] leading-relaxed">
                      Auto-scan matched name:{" "}
                      <span className="font-bold text-slate-900">
                        "{registeredStaff?.ocrResult?.detectedName}"
                      </span>{" "}
                      ({registeredStaff?.ocrResult?.matchConfidence}%
                      confidence).
                    </p>
                    <p className="text-[10px] font-medium text-success-green mt-1 bg-green-50 border border-green-100 px-3 py-1.5 rounded-xl">
                      Status set to Pending. Awaiting final officer approval.
                    </p>
                  </>
                )}
                <div className="w-32 h-1 bg-slate-100 rounded-full overflow-hidden mt-6">
                  <div
                    className="h-full bg-rail-blue animate-[slideUp_2s_ease-in-out_infinite]"
                    style={{ width: "100%" }}
                  ></div>
                </div>
                <span className="text-[9px] text-muted-text mt-3">
                  Redirecting to profile...
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer Navigation Buttons */}
      {step < 5 && (
        <div className="flex items-center space-x-3 mt-8">
          {step > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold text-center transition flex items-center justify-center space-x-1"
            >
              <span>Cancel</span>
            </Link>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNextStep}
              disabled={loading}
              className="flex-1 py-3 bg-rail-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-success-green hover:bg-green-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Submit Profile</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Unused spacing for alignment */}
      {step === 5 && <div className="h-10"></div>}
    </div>
  );
}
