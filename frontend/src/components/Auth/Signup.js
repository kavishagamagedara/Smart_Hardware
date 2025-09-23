import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const strongPwd = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:"", email:"", password:"", confirm:"", age:"", address:"", agree:false });
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (!form.name.trim()) return setErr("Name is required");
    if (!emailRe.test(form.email)) return setErr("Enter a valid email");
    if (!strongPwd.test(form.password)) return setErr("Use letters & numbers (min 6)");
    if (form.password !== form.confirm) return setErr("Passwords do not match");
    if (!form.agree) return setErr("Please accept Terms & Privacy");
    try {
      setBusy(true);
      await signup({
        name: form.name, email: form.email, password: form.password,
        age: form.age ? Number(form.age) : undefined, address: form.address || undefined
      });
      navigate("/CustomerDashboard");
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-[80vh] grid place-items-center px-4">
      <form onSubmit={submit} noValidate className="card w-full max-w-lg">
        <h2 className="text-2xl font-black">Create account</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Join Smart Hardware</p>
        {err && <div className="mb-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 px-3 py-2">{err}</div>}

        <label className="label">Name</label>
        <input className="input" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} placeholder="Jane Doe" />

        <label className="label mt-3">Email</label>
        <input className="input" type="email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} placeholder="you@example.com" />

        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input className="input pr-10" type={show1 ? "text" : "password"} value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})} placeholder="••••••••" />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-lg" onClick={()=>setShow1(s=>!s)}>{show1 ? "🙈" : "👁️"}</button>
            </div>
          </div>
          <div>
            <label className="label">Confirm password</label>
            <div className="relative">
              <input className="input pr-10" type={show2 ? "text" : "password"} value={form.confirm} onChange={(e)=>setForm({...form, confirm:e.target.value})} placeholder="••••••••" />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-lg" onClick={()=>setShow2(s=>!s)}>{show2 ? "🙈" : "👁️"}</button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="label">Age (optional)</label>
            <input className="input" type="number" value={form.age} onChange={(e)=>setForm({...form, age:e.target.value})} placeholder="25" />
          </div>
          <div>
            <label className="label">Address (optional)</label>
            <input className="input" value={form.address} onChange={(e)=>setForm({...form, address:e.target.value})} placeholder="123 Main St" />
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-brand-600" checked={form.agree} onChange={(e)=>setForm({...form, agree:e.target.checked})} />
          I agree to the Terms & Privacy
        </label>

        <button className="btn btn-primary w-full py-2 mt-4" disabled={busy}>{busy ? "Creating..." : "Create Account"}</button>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-3">
          Already have an account? <Link to="/login" className="text-brand-600 hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
