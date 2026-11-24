"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Page = "home" | "dashboard" | "surveys" | "create" | "admin" | "respond" | "results" | "profile" | "settings" | "login";
type SurveyQuestion = { prompt: string; type: string };
type Survey = { id: string; title: string; description: string; responses: number; status: "Aktif" | "Draft" | "Ditutup"; questions?: SurveyQuestion[] };
type AuthMode = "login" | "signup" | "recovery";

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid login credentials")) return "Email atau kata sandi tidak cocok. Periksa kembali lalu coba lagi.";
  if (message.includes("email not confirmed")) return "Konfirmasi emailmu terlebih dahulu sebelum masuk.";
  if (message.includes("user already registered")) return "Email ini sudah terdaftar. Coba masuk ke akunmu.";
  if (message.includes("password") && message.includes("least")) return "Kata sandi belum memenuhi panjang minimum.";
  if (message.includes("rate limit")) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  return "Kami belum bisa memproses permintaanmu. Periksa koneksi lalu coba lagi.";
}
const initialSurveys: Survey[] = [];
const navItems: { id: Page; label: string; icon: "home" | "dashboard" | "surveys" | "create" | "people" | "respond" }[] = [
  { id: "home", label: "Beranda", icon: "home" },
  { id: "dashboard", label: "Ringkasan", icon: "dashboard" },
  { id: "surveys", label: "Survei saya", icon: "surveys" },
  { id: "create", label: "Buat survei", icon: "create" },
  { id: "admin", label: "Akun pembuat", icon: "people" },
  { id: "respond", label: "Isi survei", icon: "respond" },
];

function AppIcon({ name, className = "" }: { name: "home" | "dashboard" | "surveys" | "create" | "people" | "respond"; className?: string }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-7h6v7"/></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    surveys: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    create: <><path d="M12 5v14M5 12h14"/></>,
    people: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6v1"/></>,
    respond: <><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="10" cy="19" r="1"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name]}</svg>;
}

function Button({ children, onClick, secondary = false, type = "button" }: { children: React.ReactNode; onClick?: () => void; secondary?: boolean; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} className={`rounded-lg px-4 py-2.5 text-xs font-bold transition ${secondary ? "border border-line bg-white text-ink hover:bg-slate-50" : "bg-blue text-white shadow-sm shadow-blue/20 hover:bg-[#3d51d4]"}`}>{children}</button>;
}
function Badge({ status }: { status: Survey["status"] }) {
  const styles = status === "Aktif" ? "bg-[#e8f7f2] text-[#21977e]" : status === "Draft" ? "bg-[#fff3df] text-[#bf7a15]" : "bg-[#eef1f5] text-[#718096]";
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${styles}`}>{status}</span>;
}
function PageHead({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex items-start justify-between gap-4"><div><h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1><p className="mt-1 text-[13px] text-muted">{subtitle}</p></div>{action}</div>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-white p-5 shadow-[0_8px_24px_rgba(30,45,82,.045)] ${className}`}>{children}</section>;
}

export default function Home() {
  const [page, setPage] = useState<Page>("home");
  const [surveys, setSurveys] = useState(initialSurveys);
  const [storageReady, setStorageReady] = useState(false);
  const [draftTitle, setDraftTitle] = useState("Evaluasi Perkuliahan RPL");
  const [draftDescription, setDraftDescription] = useState("Bantu kami mengevaluasi perkuliahan semester ini.");
  const [draftQuestions, setDraftQuestions] = useState<SurveyQuestion[]>([{ prompt: "Seberapa sering kamu hadir di kelas?", type: "Pilihan ganda" }, { prompt: "Nilai kejelasan penyampaian dosen", type: "Skala 1–5" }]);
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Survey["status"] | "Semua status">("Semua status");
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState({ name: "Pengguna", username: "", email: "", phone: "", institution: "", role: "Pembuat survei" });
  const [signupName, setSignupName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authChecked, setAuthChecked] = useState(!supabase);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authCheckError, setAuthCheckError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) { setAuthCheckError(true); setAuthChecked(true); }
    }, 10000);
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      window.clearTimeout(timeout);
      if (error) { setAuthCheckError(true); setAuthChecked(true); return; }
      setAuthCheckError(false);
      const user = data.session?.user;
      setIsAuthenticated(Boolean(user));
      setIsAdmin(user?.app_metadata?.role === "admin");
      setUserId(user?.id ?? null);
      if (user?.email) setProfile((current) => ({ ...current, email: user.email!, name: String(user.user_metadata?.full_name || user.user_metadata?.username || user.email!.split("@")[0]), username: String(user.user_metadata?.username || current.username), phone: String(user.user_metadata?.phone || current.phone) }));
      setAuthChecked(true);
    }).catch(() => { if (active) { window.clearTimeout(timeout); setAuthCheckError(true); setAuthChecked(true); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("recovery");
        setMessage("Buat kata sandi baru untuk akunmu.");
      }
      setIsAuthenticated(Boolean(session));
      setIsAdmin(session?.user.app_metadata?.role === "admin");
      setStorageReady(false);
      setUserId(session?.user.id ?? null);
      if (session?.user.email) setProfile((current) => ({ ...current, email: session.user.email!, name: String(session.user.user_metadata?.full_name || session.user.user_metadata?.username || session.user.email!.split("@")[0]), username: String(session.user.user_metadata?.username || current.username), phone: String(session.user.user_metadata?.phone || current.phone) }));
    });
    return () => { active = false; window.clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);

  const retrySessionCheck = async () => {
    setAuthCheckError(false); setAuthChecked(false);
    if (!supabase) { setAuthChecked(true); return; }
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setIsAuthenticated(Boolean(data.session));
      const user = data.session?.user;
      setIsAdmin(user?.app_metadata?.role === "admin");
      setStorageReady(false);
      setUserId(user?.id ?? null);
      if (user?.email) setProfile((current) => ({ ...current, email: user.email!, name: String(user.user_metadata?.full_name || user.user_metadata?.username || user.email!.split("@")[0]), username: String(user.user_metadata?.username || current.username), phone: String(user.user_metadata?.phone || current.phone) }));
      setAuthChecked(true);
    } catch { setAuthCheckError(true); setAuthChecked(true); }
  };

  const handlePasswordReset = async () => {
    setMessage("");
    if (!supabase) { setMessage("Konfigurasi Supabase belum terisi di .env.local."); return; }
    if (!loginEmail.trim()) { setMessage("Masukkan email akunmu terlebih dahulu."); return; }
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, { redirectTo: window.location.origin });
      setMessage(error ? "Email reset belum bisa dikirim. Periksa alamat email dan coba lagi." : "Tautan untuk mengatur ulang kata sandi sudah dikirim ke emailmu.");
    } catch { setMessage("Email reset belum bisa dikirim. Periksa koneksi lalu coba lagi."); }
    finally { setAuthLoading(false); }
  };

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage("");
    if (!supabase) { setMessage("Konfigurasi Supabase belum terisi di .env.local."); return; }
    setAuthLoading(true);
    try {
      if (authMode === "recovery") {
        const { error } = await supabase.auth.updateUser({ password: loginPassword });
        if (error) throw error;
        setLoginPassword("");
        setAuthMode("login");
        setMessage("Kata sandi berhasil diperbarui. Silakan masuk kembali.");
      } else if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
        if (error) throw error;
        setPage("home");
      } else {
        const { data, error } = await supabase.auth.signUp({ email: loginEmail, password: loginPassword, options: { emailRedirectTo: window.location.origin, data: { full_name: signupName, username: signupUsername, phone: signupPhone } } });
        if (error) throw error;
        if (data.session) setPage("home");
        else setMessage("Akun dibuat. Buka emailmu untuk konfirmasi, lalu masuk.");
      }
    } catch (error) { setMessage(authErrorMessage(error)); }
    finally { setAuthLoading(false); }
  };

  useEffect(() => {
    if (!authChecked || !isAuthenticated || !userId) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        setSurveys(initialSurveys);
        setDraftTitle("Evaluasi Perkuliahan RPL");
        setDraftDescription("Bantu kami mengevaluasi perkuliahan semester ini.");
        setDraftQuestions([{ prompt: "Seberapa sering kamu hadir di kelas?", type: "Pilihan ganda" }, { prompt: "Nilai kejelasan penyampaian dosen", type: "Skala 1–5" }]);
        const savedSurveys = localStorage.getItem(`ruangSurvei:${userId}:surveys`);
        const savedDraft = localStorage.getItem(`ruangSurvei:${userId}:draft`);
        if (savedSurveys) setSurveys((JSON.parse(savedSurveys) as Survey[]).map((survey) => ({ ...survey, id: survey.id || crypto.randomUUID() })));
        if (savedDraft) {
          const draft = JSON.parse(savedDraft) as { surveyId?: string; title?: string; description?: string; questions?: SurveyQuestion[] };
          if (draft.surveyId) setEditingSurveyId(draft.surveyId);
          if (draft.title) setDraftTitle(draft.title);
          if (draft.description) setDraftDescription(draft.description);
          if (draft.questions?.length) setDraftQuestions(draft.questions);
        }
      } catch { setMessage("Data draft di browser tidak bisa dibaca."); }
      setStorageReady(true);
    });
    return () => { cancelled = true; };
  }, [authChecked, isAuthenticated, userId]);

  useEffect(() => { if (storageReady && userId) try { localStorage.setItem(`ruangSurvei:${userId}:surveys`, JSON.stringify(surveys)); } catch {} }, [surveys, storageReady, userId]);
  useEffect(() => { if (storageReady && userId) try { localStorage.setItem(`ruangSurvei:${userId}:draft`, JSON.stringify({ surveyId: editingSurveyId, title: draftTitle, description: draftDescription, questions: draftQuestions })); } catch {} }, [draftTitle, draftDescription, draftQuestions, editingSurveyId, storageReady, userId]);

  const saveDraft = () => {
    if (!draftTitle.trim()) { setMessage("Isi judul survei terlebih dahulu."); return; }
    const legacyDraft = !editingSurveyId ? surveys.find((survey) => survey.status === "Draft" && survey.title === draftTitle.trim()) : undefined;
    const draft: Survey = { id: editingSurveyId || legacyDraft?.id || crypto.randomUUID(), title: draftTitle.trim(), description: draftDescription.trim() || "Draft survei", responses: surveys.find((survey) => survey.id === editingSurveyId)?.responses ?? 0, status: surveys.find((survey) => survey.id === (editingSurveyId || legacyDraft?.id))?.status ?? "Draft", questions: draftQuestions };
    setEditingSurveyId(draft.id);
    setSurveys((current) => {
      const existing = current.findIndex((survey) => survey.id === draft.id);
      if (existing < 0) return [...current, draft];
      return current.map((survey, index) => index === existing ? draft : survey);
    });
    setMessage("Draft tersimpan di browser ini.");
  };

  const filteredSurveys = useMemo(() => surveys.filter((survey) => survey.title.toLowerCase().includes(query.toLowerCase()) && (statusFilter === "Semua status" || survey.status === statusFilter)), [surveys, query, statusFilter]);
  const initials = profile.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const go = (nextPage: Page) => { setPage(nextPage); setMenuOpen(false); setMessage(""); };
  const startNewSurvey = () => { setEditingSurveyId(null); setDraftTitle(""); setDraftDescription(""); setDraftQuestions([{ prompt: "", type: "Pilihan ganda" }]); go("create"); };
  const editSurvey = (survey: Survey) => { setEditingSurveyId(survey.id); setDraftTitle(survey.title); setDraftDescription(survey.description); setDraftQuestions(survey.questions?.length ? survey.questions : [{ prompt: "", type: "Pilihan ganda" }]); go("create"); };
  const deleteSurvey = (survey: Survey) => { if (!window.confirm(`Hapus survei “${survey.title}”? Tindakan ini tidak bisa dibatalkan.`)) return; setSurveys((current) => current.filter((item) => item.id !== survey.id)); setMessage(`Survei “${survey.title}” berhasil dihapus.`); };

  function home() { return <><section className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-dark to-blue p-7 text-white shadow-lg sm:p-9"><span className="text-sm font-semibold text-indigo-100">RUANGSURVEI · WORKSPACE</span><h1 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Halo, {profile.name.split(" ")[0]} 👋</h1><p className="mt-3 max-w-xl text-base leading-7 text-indigo-100">Kelola survei, kumpulkan masukan, dan ubah respons menjadi keputusan yang lebih baik.</p><div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => startNewSurvey()}>＋ Buat survei</Button><Button secondary onClick={() => go("dashboard")}>Lihat ringkasan</Button></div></section><div className="mb-6 grid gap-4 sm:grid-cols-3"><button onClick={() => go("surveys")} className="rounded-xl border border-line bg-white p-5 text-left shadow-[0_8px_24px_rgba(30,45,82,.045)] transition hover:-translate-y-0.5 hover:shadow-md"><span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#eef0ff] text-lg text-blue">▤</span><b className="block text-base">Survei saya</b><span className="mt-1 block text-sm text-muted">Lihat dan kelola survei yang sudah dibuat.</span></button><button onClick={startNewSurvey} className="rounded-xl border border-line bg-white p-5 text-left shadow-[0_8px_24px_rgba(30,45,82,.045)] transition hover:-translate-y-0.5 hover:shadow-md"><span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#eef0ff] text-lg text-blue">＋</span><b className="block text-base">Buat survei baru</b><span className="mt-1 block text-sm text-muted">Mulai dengan pertanyaan yang ingin kamu ajukan.</span></button><button onClick={() => go("respond")} className="rounded-xl border border-line bg-white p-5 text-left shadow-[0_8px_24px_rgba(30,45,82,.045)] transition hover:-translate-y-0.5 hover:shadow-md"><span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#eef0ff] text-lg text-blue">☷</span><b className="block text-base">Pratinjau survei</b><span className="mt-1 block text-sm text-muted">Lihat contoh tampilan untuk responden.</span></button></div><Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Mulai dari sini</h2><p className="mt-1 text-sm text-muted">Pantau aktivitas dan lanjutkan pekerjaanmu dari Ringkasan.</p></div><Button secondary onClick={() => go("dashboard")}>Buka ringkasan →</Button></div></Card></>; }

  const stats = (items: { label: string; value: string; note?: string; icon: string }[]) => <div className="mb-5 grid gap-4 sm:grid-cols-3">{items.map((item) => <Card className="relative p-5" key={item.label}><span className="text-xs text-muted">{item.label}</span><span className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-[#eef0ff] text-blue">{item.icon}</span><div className="mt-2 text-3xl font-extrabold tracking-tight">{item.value}<small className="ml-2 text-xs font-bold text-green">{item.note}</small></div></Card>)}</div>;

  function dashboard() {
    const totalResponses = surveys.reduce((sum, survey) => sum + survey.responses, 0);
    const averageResponses = surveys.length ? Math.round(totalResponses / surveys.length) : 0;
    const activeCount = surveys.filter((survey) => survey.status === "Aktif").length;
    const statusCounts = (["Aktif", "Draft", "Ditutup"] as const).map((status) => ({ status, count: surveys.filter((survey) => survey.status === status).length }));
    return <><PageHead title={`Selamat pagi, ${profile.name}`} subtitle="Kelola survei dan pantau respons dalam satu tempat." action={<Button onClick={startNewSurvey}>＋ Buat survei</Button>} />{stats([{ label: "Total survei", value: String(surveys.length), note: `${activeCount} aktif`, icon: "▣" }, { label: "Total respons", value: new Intl.NumberFormat("id-ID").format(totalResponses), note: "semua survei", icon: "↗" }, { label: "Rata-rata respons", value: String(averageResponses), note: "per survei", icon: "✳" }])}<div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]"><Card><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-bold">Survei terbaru</h2><p className="mt-1 text-sm text-muted">Lanjutkan pekerjaan terakhir kamu.</p></div><Button secondary onClick={() => go("surveys")}>Lihat semua</Button></div>{surveys.length ? surveys.slice(0, 3).map((survey) => <div key={survey.id} className="flex items-center gap-3 border-t border-line py-3"><span className="h-7 w-7 rounded-full bg-[#eef0ff]"/><div className="min-w-0 flex-1"><strong className="block text-xs">{survey.title}</strong><small className="text-xs text-muted">{survey.responses} respons</small></div><Badge status={survey.status}/><span className="text-muted">›</span></div>) : <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center"><p className="text-sm font-semibold">Belum ada survei</p><p className="mt-1 text-sm text-muted">Buat survei pertama untuk mulai mengumpulkan masukan.</p><Button onClick={startNewSurvey}>＋ Buat survei</Button></div>}</Card><Card><h2 className="text-sm font-bold">Status survei</h2><p className="mb-3 mt-1 text-sm text-muted">Jumlah menurut status</p>{statusCounts.map(({ status, count }) => <div className="flex items-center justify-between border-t border-line py-3 text-sm" key={status}><Badge status={status}/><b>{count}</b></div>)}</Card></div><div className="mt-4 rounded-xl bg-[#eef0ff] p-5"><b className="text-sm">Tips membuat survei yang nyaman dijawab</b><p className="mt-1 text-sm text-muted">Gunakan pertanyaan singkat, jelaskan tujuan survei, dan tampilkan estimasi waktu.</p><button onClick={startNewSurvey} className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-bold">Buat survei pertama</button></div></>;
  }

  function surveyList() {
    return <><PageHead title="Survei saya" subtitle="Kelola draft survei yang tersimpan di browser ini." action={<Button onClick={startNewSurvey}>＋ Buat survei</Button>} /><div className="mb-4 flex flex-wrap items-center gap-2"><input className="min-w-[220px] flex-1 rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-blue" placeholder="Cari survei..." value={query} onChange={(event) => setQuery(event.target.value)}/><select aria-label="Filter status survei" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Survey["status"] | "Semua status")} className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm"><option>Semua status</option><option>Aktif</option><option>Draft</option><option>Ditutup</option></select><small className="text-muted">{filteredSurveys.length} survei</small></div>{message && <p role="status" className="mb-3 text-sm text-green">{message}</p>}<div className="grid gap-3">{filteredSurveys.map((survey) => <Card key={survey.id} className="flex flex-wrap items-center gap-3 p-4"><span className="h-8 w-8 rounded-full bg-[#eef0ff]"/><div className="min-w-40 flex-1"><b className="block text-sm">{survey.title}</b><small className="text-sm text-muted">{survey.description} · {survey.responses} respons</small></div><Badge status={survey.status}/><div className="flex flex-wrap gap-3"><button className="text-sm font-bold text-blue" onClick={() => editSurvey(survey)}>Edit</button><button className="text-sm font-bold text-blue" onClick={() => go("results")}>Hasil</button><button className="text-sm font-bold text-red-600 hover:text-red-700" onClick={() => deleteSurvey(survey)}>Hapus</button></div></Card>)}{filteredSurveys.length === 0 && <Card className="py-12 text-center">{surveys.length === 0 ? <><p className="text-base font-semibold">Belum ada survei</p><p className="my-2 text-sm text-muted">Buat survei pertama untuk mulai mengumpulkan jawaban.</p><Button onClick={startNewSurvey}>＋ Buat survei</Button></> : <p className="text-sm text-muted">Survei tidak ditemukan. Coba kata kunci atau status lain.</p>}</Card>}</div></>;
  }

  function createSurvey() {
    const updateQuestion = (index: number, changes: Partial<SurveyQuestion>) => setDraftQuestions((current) => current.map((question, i) => i === index ? { ...question, ...changes } : question));
    return <><PageHead title="Buat survei" subtitle="Susun pertanyaan dan simpan draft survei di browser ini." action={<div className="flex gap-2"><Button secondary onClick={() => go("respond")}>Pratinjau</Button><Button onClick={saveDraft}>Simpan draft</Button></div>} /><Card className="mb-4"><h2 className="mb-4 text-sm font-bold">Detail survei</h2><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">Judul survei<input className="mt-1.5 block w-full rounded-lg border border-line px-3 py-2.5 text-xs font-normal" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)}/></label><label className="text-sm font-bold">Deskripsi singkat<input className="mt-1.5 block w-full rounded-lg border border-line px-3 py-2.5 text-xs font-normal" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)}/></label></div></Card><Card><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Pertanyaan <span className="font-normal text-muted">{draftQuestions.length} pertanyaan</span></h2><Button secondary onClick={() => setDraftQuestions((current) => [...current, { prompt: "", type: "Pilihan ganda" }])}>＋ Tambah pertanyaan</Button></div>{draftQuestions.map((question, index) => <div className="mt-3 rounded-lg border border-line p-4" key={index}><div className="flex flex-wrap items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#eef0ff] text-xs font-bold text-blue">{index + 1}</span><input className="min-w-48 flex-1 rounded-lg border border-line px-3 py-2 text-xs" value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="Tulis pertanyaan kamu..."/><select className="rounded-lg border border-line px-3 py-2 text-xs" value={question.type} onChange={(event) => updateQuestion(index, { type: event.target.value })}><option>Pilihan ganda</option><option>Skala 1–5</option><option>Jawaban singkat</option></select><button type="button" aria-label={`Hapus pertanyaan ${index + 1}`} onClick={() => setDraftQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index))} className="rounded-lg px-2 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Hapus</button></div>{index === 0 && <div className="ml-8 mt-3 flex gap-2 text-sm text-muted"><span className="rounded-md border border-line px-3 py-1.5">Selalu</span><span className="rounded-md border border-line px-3 py-1.5">Sering</span><span className="rounded-md border border-line px-3 py-1.5">Jarang</span></div>}</div>)}{message && <p className="mt-4 text-xs text-green">{message}</p>}</Card></>;
  }

  function profilePage() {
    const saveProfile = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const updated = { ...profile, name: String(form.get("name")), username: String(form.get("username")), phone: String(form.get("phone")), institution: String(form.get("institution")) }; if (supabase) { try { const { error } = await supabase.auth.updateUser({ data: { full_name: updated.name, username: updated.username, phone: updated.phone } }); if (error) throw error; setProfile(updated); setMessage("Profil berhasil diperbarui."); } catch (error) { setMessage(authErrorMessage(error)); } } else { setProfile(updated); setMessage("Profil diperbarui di sesi ini."); } };
    return <><PageHead title="Profil saya" subtitle="Kelola informasi akun dan preferensi kamu."/><div className="grid items-start gap-4 lg:grid-cols-[.75fr_2fr]"><Card className="text-center"><div className="mx-auto mb-3 grid h-[76px] w-[76px] place-items-center rounded-full bg-[#e6eaff] text-xl font-extrabold text-blue">{initials}</div><h2 className="text-base font-bold">{profile.name}</h2><p className="mb-3 mt-1 text-xs text-muted">{profile.role}</p><Badge status="Aktif"/><div className="mt-5 border-t border-line pt-4 text-left text-sm"><span className="block text-muted">Bergabung sejak</span><b>Oktober 2026</b></div></Card><Card><div className="mb-5"><h2 className="text-sm font-bold">Informasi pribadi</h2><p className="mt-1 text-sm text-muted">Perbarui data yang digunakan di akun RuangSurvei.</p></div><form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">{([["name", "Nama lengkap", profile.name], ["username", "Username", profile.username], ["email", "Email", profile.email], ["phone", "Nomor telepon", profile.phone], ["institution", "Institusi", profile.institution]] as const).map(([name, label, value]) => <label key={name} className="text-sm font-bold">{label}<input name={name} type={name === "email" ? "email" : "text"} readOnly={name === "email"} title={name === "email" ? "Perubahan email dilakukan melalui pengaturan autentikasi." : undefined} required={name === "name" || name === "email"} className="mt-1.5 block w-full rounded-lg border border-line px-3 py-2.5 text-xs font-normal outline-none focus:border-blue" defaultValue={value}/></label>)}<label className="text-sm font-bold">Peran akun<input disabled className="mt-1.5 block w-full rounded-lg border border-line bg-slate-50 px-3 py-2.5 text-xs font-normal" value={profile.role}/></label><div className="flex items-end justify-between gap-3 sm:col-span-2">{message && <span className="text-sm text-green">{message}</span>}<Button type="submit">Simpan perubahan</Button></div></form></Card><Card className="lg:col-start-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold">Keamanan akun</h2><p className="mt-1 text-sm text-muted">Ubah kata sandi secara berkala untuk menjaga akun kamu.</p></div><Button secondary onClick={() => setMessage("Fitur ubah kata sandi aktif setelah Supabase Auth disambungkan.")}>Ubah kata sandi</Button></div></Card></div></>;
  }

  function settings() { return <><PageHead title="Pengaturan" subtitle="Atur preferensi penggunaan RuangSurvei."/><Card className="max-w-3xl"><h2 className="mb-2 text-sm font-bold">Preferensi</h2>{[["Notifikasi email", "Terima kabar saat survei mendapat respons baru."], ["Pengingat survei", "Ingatkan saya untuk meninjau survei yang masih aktif."]].map(([title, desc]) => <label key={title} className="flex items-center justify-between gap-4 border-b border-line py-4"><span><b className="block text-xs">{title}</b><small className="mt-1 block text-sm text-muted">{desc}</small></span><input type="checkbox" defaultChecked={title.startsWith("Notifikasi")}/></label>)}<label className="flex items-center justify-between gap-4 py-4"><span><b className="block text-xs">Bahasa</b><small className="mt-1 block text-sm text-muted">Bahasa antarmuka.</small></span><select className="rounded-lg border border-line bg-white px-3 py-2 text-xs"><option>Bahasa Indonesia</option><option>English</option></select></label><Button onClick={() => setMessage("Pengaturan tersimpan di demo.")}>Simpan pengaturan</Button>{message && <span className="ml-3 text-sm text-green">{message}</span>}</Card></>; }

  function admin() { return <><PageHead title="Dashboard admin" subtitle="Area admin untuk pengelolaan pengguna."/><Card className="max-w-3xl"><h2 className="text-base font-bold">Pengelolaan pengguna belum tersambung</h2><p className="mt-2 text-sm leading-6 text-muted">Menu ini hanya tampil untuk akun dengan peran admin di metadata Supabase. Daftar pengguna memerlukan tabel dan kebijakan akses server sebelum bisa ditampilkan dengan aman.</p></Card></>; }

  function results() { return <><PageHead title="Hasil survei" subtitle="Ringkasan jawaban akan muncul setelah respons tersimpan."/><Card className="max-w-3xl text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#eef0ff] text-xl text-blue">↗</div><h2 className="text-base font-bold">Belum ada data hasil</h2><p className="mt-2 text-sm leading-6 text-muted">Penyimpanan jawaban ke database belum diaktifkan. Hubungkan tabel survei dan respons Supabase untuk menampilkan analisis nyata di sini.</p></Card></>; }

  function respondent() { return <div className="mx-auto max-w-3xl"><PageHead title="Evaluasi Perkuliahan RPL" subtitle="Bantu kami menilai layanan perkuliahan semester ini."/><Card className="mb-3"><div className="mb-2 flex justify-between text-sm text-muted"><span>PROGRES SURVEI</span><b>1 dari 4</b></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full w-1/3 rounded-full bg-blue"/></div></Card>{[["1. Seberapa sering kamu hadir di kelas?", ["Selalu", "Sering", "Jarang"]], ["2. Materi mana yang paling membantu?", ["SDLC", "UML", "Git", "Testing"]]].map(([question, options]) => <Card key={question as string} className="mb-3"><h2 className="mb-3 text-xs font-bold">{question}</h2>{(options as string[]).map((option) => <label key={option} className="flex items-center gap-2 py-1.5 text-xs text-slate-600"><input type="checkbox"/> {option}</label>)}</Card>)}<Card className="mb-3"><h2 className="mb-3 text-xs font-bold">3. Nilai kejelasan penyampaian dosen</h2><div className="flex gap-2">{[1,2,3,4,5].map((score) => <button key={score} className="h-10 w-12 rounded-lg border border-line text-xs font-bold hover:border-blue hover:bg-[#eef0ff]">{score}</button>)}</div></Card><div className="flex justify-end"><Button onClick={() => setMessage("Jawaban kamu tersimpan di demo.")}>Lanjutkan</Button></div>{message && <p className="mt-3 text-right text-xs text-green">{message}</p>}</div>; }

  function login() { return <div className="auth-enter grid min-h-screen bg-bg md:grid-cols-2"><div className="relative hidden flex-col justify-center overflow-hidden bg-blue-dark px-[10%] text-white md:flex"><div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/10"/><div className="absolute -bottom-36 -left-24 h-96 w-96 rounded-full border border-white/10"/><div className="relative font-extrabold"><span className="mr-2 rounded-lg bg-white px-2 py-1 text-blue">S</span>RuangSurvei</div><h1 className="relative mt-16 text-4xl font-extrabold">Dengar lebih banyak.</h1><p className="relative mt-3 max-w-sm text-base text-indigo-100">Ubah jawaban menjadi keputusan yang lebih baik.</p><div className="auth-panel relative mt-10 max-w-md rounded-2xl border border-white/15 bg-white/10 p-6 shadow-xl backdrop-blur-sm"><div className="mb-5 flex items-center justify-between"><div><span className="block text-sm font-bold">Suara responden</span><span className="mt-1 block text-sm text-indigo-100">Membantu keputusan yang lebih tepat</span></div><span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-xl">↗</span></div><div className="flex h-20 items-end gap-3" aria-hidden="true">{[32,52,45,75,59,91,63].map((height, i) => <span key={i} className="flex-1 rounded-t-md bg-indigo-200/90" style={{ height: height + "%" }}/>)}</div><div className="mt-4 flex items-center gap-2 text-sm text-indigo-100"><span className="h-2 w-2 rounded-full bg-emerald-300"/>Sederhanakan pengumpulan dan pemahaman masukan</div></div></div><div className="grid place-items-center p-5 sm:p-8"><Card className="w-full max-w-md p-7 sm:p-9"><h2 className="text-2xl font-bold">{authMode === "recovery" ? "Atur ulang kata sandi" : authMode === "login" ? "Selamat datang kembali" : "Buat akun RuangSurvei"}</h2><p className="mb-6 mt-2 text-sm text-muted">{authMode === "recovery" ? "Gunakan kata sandi baru yang kuat dan mudah kamu ingat." : authMode === "login" ? "Masuk dengan email dan kata sandi kamu." : "Daftar menggunakan email yang aktif."}</p><form onSubmit={handleAuth}>{authMode === "signup" && <><label className="mb-4 block text-sm font-bold">Nama lengkap<input required className="mt-2 block w-full rounded-lg border border-line px-3 py-3 text-sm font-normal" placeholder="Nama lengkap" value={signupName} onChange={(event) => setSignupName(event.target.value)}/></label><label className="mb-4 block text-sm font-bold">Username<input required minLength={3} className="mt-2 block w-full rounded-lg border border-line px-3 py-3 text-sm font-normal" placeholder="username" value={signupUsername} onChange={(event) => setSignupUsername(event.target.value)}/></label><label className="mb-4 block text-sm font-bold">Nomor HP<input className="mt-2 block w-full rounded-lg border border-line px-3 py-3 text-sm font-normal" placeholder="08xxxxxxxxxx" type="tel" value={signupPhone} onChange={(event) => setSignupPhone(event.target.value)}/></label></>}{authMode !== "recovery" && <label className="mb-4 block text-sm font-bold">Email<input required className="mt-2 block w-full rounded-lg border border-line px-3 py-3 text-sm font-normal" placeholder="nama@email.com" type="email" autoComplete="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)}/></label>}<label className="mb-2 block text-sm font-bold">{authMode === "recovery" ? "Kata sandi baru" : "Kata sandi"}<div className="relative mt-2"><input required minLength={6} className="block w-full rounded-lg border border-line px-3 py-3 pr-20 text-sm font-normal" placeholder="Minimal 6 karakter" type={showPassword ? "text" : "password"} autoComplete={authMode === "login" ? "current-password" : "new-password"} value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)}/><button type="button" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-2 rounded-md px-2 text-sm font-semibold text-blue hover:bg-[#eef0ff]">{showPassword ? "Sembunyikan" : "Lihat"}</button></div></label>{authMode === "login" && <div className="mb-3 mt-2 text-right"><button type="button" onClick={handlePasswordReset} disabled={authLoading} className="text-sm font-semibold text-blue hover:underline">Lupa kata sandi?</button></div>}<button disabled={authLoading} type="submit" className="mt-2 w-full rounded-lg bg-blue px-4 py-3 text-sm font-bold text-white transition hover:bg-[#3d51d4] disabled:opacity-60">{authLoading ? "Memproses..." : authMode === "recovery" ? "Simpan kata sandi baru" : authMode === "login" ? "Masuk ke akun" : "Daftar"}</button></form>{message && <p role="status" className="mt-4 rounded-lg bg-[#fff6e9] px-3 py-2.5 text-sm text-amber-800">{message}</p>}{authMode !== "recovery" && <p className="mt-5 text-center text-sm text-muted">{authMode === "login" ? "Belum punya akun?" : "Sudah punya akun?"} <button className="font-bold text-blue hover:underline" onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setMessage(""); setShowPassword(false); }}>{authMode === "login" ? "Daftar" : "Masuk"}</button></p>}</Card></div></div>; }

  const content: Record<Page, React.ReactNode> = { home: home(), dashboard: dashboard(), surveys: surveyList(), create: createSurvey(), admin: admin(), respond: respondent(), results: results(), profile: profilePage(), settings: settings(), login: login() };
  if (!authChecked) return <div role="status" aria-live="polite" className="grid min-h-screen place-items-center bg-bg px-5 text-base text-muted"><div className="text-center"><span className="mx-auto mb-4 block h-8 w-8 animate-spin rounded-full border-2 border-blue/20 border-t-blue"/><p>Memeriksa sesi login...</p></div></div>;
  if (authCheckError) return <div className="grid min-h-screen place-items-center bg-bg px-5"><Card className="w-full max-w-md text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#fff3df] text-xl text-[#bf7a15]">!</div><h1 className="text-xl font-bold">Sesi belum bisa diperiksa</h1><p className="my-3 text-sm leading-6 text-muted">Koneksi ke layanan akun terputus atau memerlukan waktu lebih lama. Periksa koneksi internet, lalu coba lagi.</p><Button onClick={retrySessionCheck}>Coba lagi</Button></Card></div>;
  if (authMode === "recovery") return login();
  if (!isAuthenticated) return login();
  return <div className="min-h-screen"><aside className="fixed inset-y-0 left-0 z-20 flex w-[218px] flex-col border-r border-line bg-white px-3.5 py-5 max-[640px]:w-[72px] max-[640px]:px-2"><div className="mb-7 flex items-center gap-2.5 px-2 font-extrabold tracking-tight"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue text-white">S</span><span className="max-[640px]:hidden">RuangSurvei</span></div><nav className="grid gap-1">{navItems.filter((item) => item.id !== "admin" || isAdmin).map((item) => <button key={item.id} onClick={() => go(item.id)} aria-label={item.label} title={item.label} aria-current={page === item.id ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${page === item.id ? "bg-[#eef0ff] font-bold text-blue" : "text-slate-500 hover:bg-slate-50"}`}><AppIcon name={item.icon as "home" | "dashboard" | "surveys" | "create" | "people" | "respond"} className="h-5 w-5 shrink-0"/><span className="max-[640px]:hidden">{item.label}</span></button>)}</nav><div className="relative mt-auto pt-3"><button onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} className="flex w-full items-center gap-2.5 border-0 bg-transparent px-1 py-2 text-left outline-none hover:bg-transparent focus:ring-0 max-[640px]:justify-center"><span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[#e6eaff] text-sm font-extrabold text-blue">{initials}</span><span className="min-w-0 flex-1 max-[640px]:hidden"><b className="block truncate text-sm">{profile.name}</b><small className="block text-xs text-muted">{profile.role}</small></span><span className="text-xs text-muted max-[640px]:hidden">{menuOpen ? "⌄" : "⌃"}</span></button>{menuOpen && <div className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-full rounded-xl border border-line bg-white p-1.5 shadow-xl max-[640px]:w-[205px]"><div className="border-b border-line px-2.5 py-2"><b className="block text-xs">{profile.name}</b><small className="text-xs text-muted">{profile.email}</small></div><button onClick={() => go("profile")} className="w-full rounded-lg px-2.5 py-2.5 text-left text-xs text-slate-600 hover:bg-bg">♙ &nbsp; Profil</button><button onClick={() => go("settings")} className="w-full rounded-lg px-2.5 py-2.5 text-left text-xs text-slate-600 hover:bg-bg">⚙ &nbsp; Pengaturan</button><button onClick={async () => { if (supabase) await supabase.auth.signOut(); go("login"); }} className="w-full rounded-lg px-2.5 py-2.5 text-left text-xs text-slate-600 hover:bg-bg">↪ &nbsp; Keluar</button></div>}</div></aside><main className="ml-[218px] min-h-screen max-[640px]:ml-[72px]"><header className="flex h-[60px] items-center justify-between border-b border-line bg-white px-8 text-xs text-muted max-[640px]:px-4"><span>Workspace / {profile.name}</span><span className="grid h-7 w-7 place-items-center rounded-full bg-[#e6eaff] text-[9px] font-bold text-blue">{initials}</span></header><section key={page} className="page-transition mx-auto max-w-[1400px] p-8 max-[900px]:p-6 max-[640px]:p-4">{content[page]}</section></main></div>;
}




