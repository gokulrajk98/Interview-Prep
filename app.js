(() => {
  "use strict";
  const STORAGE_KEY = "interviewPrepHub.questions.v1";
  const CATEGORY_KEY = "interviewPrepHub.categories.v1";
  const DEFAULT_CATEGORIES = [
    "Manual Testing", "Playwright JavaScript", "Playwright TypeScript",
    "JavaScript", "TypeScript", "API Testing", "Framework Development",
    "Pytest / Python", "Selenium / Java", "CI/CD & GitHub Actions",
    "SQL & Database", "Agile & Scrum", "Scenario Based", "HR & Self Introduction", "Other"
  ];
  const $ = (id) => document.getElementById(id);
  let questions = [];
  let categories = [...DEFAULT_CATEGORIES];
  let activeCategory = "";
  let toastTimer;
  let supabaseClient = null;
  let currentUser = null;
  let cloudReady = false;
  let cloudSaveTimer = null;
  let authMode = "signin";

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[char]));
  const makeId = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function notify(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }
  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
      localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
      updateStorageInfo();
      return true;
    } catch (error) {
      notify("Could not save a local backup. Your browser storage may be unavailable.");
      return false;
    }
  }
  function save() {
    if (!saveLocal()) return false;
    if (cloudReady && currentUser && supabaseClient) {
      clearTimeout(cloudSaveTimer);
      cloudSaveTimer = setTimeout(() => saveCloud().catch(error => {
        console.error("Cloud save failed:", error);
        setStorageStatus("Cloud sync issue", "Local backup retained");
        notify("Cloud sync failed. Your local backup is still saved; check your connection.");
      }), 450);
    }
    return true;
  }
  function setStorageStatus(title, subtitle) {
    if ($("storage-status-title")) $("storage-status-title").textContent = title;
    if ($("storage-status-subtitle")) $("storage-status-subtitle").textContent = subtitle;
  }
  async function saveCloud() {
    if (!cloudReady || !currentUser || !supabaseClient) return;
    const payload = { questions, categories };
    const { error } = await supabaseClient.from("user_workspaces").upsert({
      user_id: currentUser.id, payload, updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (error) throw error;
    setStorageStatus("Cloud storage connected", "All devices synchronized");
    updateStorageInfo();
  }
  async function loadCloudForUser(user) {
    cloudReady = false;
    currentUser = user;
    setStorageStatus("Connecting to cloud…", user.email || "Signed in");
    const { data, error } = await supabaseClient.from("user_workspaces")
      .select("payload").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (data && data.payload) {
      questions = Array.isArray(data.payload.questions) ? data.payload.questions : [];
      const cloudCategories = Array.isArray(data.payload.categories) ? data.payload.categories : [];
      categories = [...new Set([...DEFAULT_CATEGORIES, ...cloudCategories.filter(x => typeof x === "string")])];
      saveLocal();
    } else {
      // First sign-in: migrate this browser's existing question bank into the user's private cloud row.
      categories = [...new Set([...DEFAULT_CATEGORIES, ...categories])];
      const { error: insertError } = await supabaseClient.from("user_workspaces").insert({
        user_id: user.id, payload: { questions, categories }
      });
      if (insertError) throw insertError;
    }
    cloudReady = true;
    $("auth-gate").classList.add("hidden");
    $("app-shell").classList.remove("hidden");
    setStorageStatus("Cloud storage connected", "Private sync · " + (user.email || "Signed in"));
    updateStorageInfo();
    renderAll();
  }
  function showAuthMessage(message, success = false) {
    const el = $("auth-message");
    el.textContent = message;
    el.classList.toggle("success", success);
  }
  function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === "signup";
    $("auth-heading").textContent = signup ? "Create your private account" : "Sign in to your workspace";
    $("auth-submit").textContent = signup ? "Create account" : "Sign in";
    $("auth-switch-label").textContent = signup ? "Already have an account?" : "New here?";
    $("auth-mode-toggle").textContent = signup ? "Sign in" : "Create an account";
    $("auth-password").autocomplete = signup ? "new-password" : "current-password";
    showAuthMessage("");
  }
  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!supabaseClient) return showAuthMessage("Cloud setup is not complete. Add your Supabase URL and anon/publishable key to config.js, then redeploy.");
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;
    $("auth-submit").disabled = true;
    showAuthMessage(authMode === "signup" ? "Creating your account…" : "Signing in…");
    try {
      if (authMode === "signup") {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) await loadCloudForUser(data.user);
        else showAuthMessage("Account created. Check your email for the confirmation link, then return here and sign in.", true);
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await loadCloudForUser(data.user);
      }
    } catch (error) {
      console.error(error);
      showAuthMessage(error.message || "Authentication failed. Please try again.");
    } finally {
      $("auth-submit").disabled = false;
    }
  }
  async function bootstrapCloud() {
    const config = window.SUPABASE_CONFIG || {};
    const configured = config.url && config.anonKey && !config.url.includes("YOUR_") && !config.anonKey.includes("YOUR_");
    if (!configured || !window.supabase?.createClient) {
      showAuthMessage("Supabase setup is not complete yet. Add your project URL and anon/publishable key to config.js, then redeploy this folder.");
      return;
    }
    supabaseClient = window.supabase.createClient(config.url, config.anonKey);
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) { showAuthMessage(error.message); return; }
    if (data.session?.user) {
      try { await loadCloudForUser(data.session.user); }
      catch (err) { console.error(err); showAuthMessage("Could not load your cloud workspace: " + err.message); }
    }
    supabaseClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        cloudReady = false; currentUser = null;
        $("app-shell").classList.add("hidden");
        $("auth-gate").classList.remove("hidden");
        showAuthMessage("You have signed out.", true);
      }
    });
  }
  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      questions = Array.isArray(stored) ? stored.filter(q => q && typeof q.question === "string") : [];
      const storedCategories = JSON.parse(localStorage.getItem(CATEGORY_KEY) || "null");
      if (Array.isArray(storedCategories)) categories = [...new Set([...DEFAULT_CATEGORIES, ...storedCategories.filter(x => typeof x === "string")])];
    } catch (error) {
      questions = [];
      categories = [...DEFAULT_CATEGORIES];
      notify("Stored data could not be read. Import a JSON backup if you have one.");
    }
  }
  function updateStorageInfo() {
    const count = questions.length;
    const detail = `${count} question${count === 1 ? "" : "s"} and ${categories.length} categories are saved in your private cloud workspace${currentUser ? ` for ${currentUser.email}` : ""}.`;
    if ($("storage-detail")) $("storage-detail").textContent = detail;
    if ($("nav-count")) $("nav-count").textContent = count;
  }
  function categoryOptions(selected = "") {
    return categories.map(c => `<option value="${escapeHtml(c)}" ${c === selected ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
  }
  function renderCategoryNav() {
    $("category-nav").innerHTML = categories.map((c, i) =>
      `<button class="nav-item ${activeCategory === c ? "active" : ""}" data-category="${escapeHtml(c)}"><span>${["◈","⌘","◇","▧","⌁"][i % 5]}</span>${escapeHtml(c)}</button>`
    ).join("");
    $("question-category").innerHTML = categoryOptions($("question-category").value || categories[0]);
  }
  function showView(view) {
    document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === `view-${view}`));
    document.querySelectorAll("[data-view]").forEach(el => el.classList.toggle("active", el.dataset.view === view && !activeCategory));
    const labels = { dashboard:"Dashboard", questions: activeCategory || "All questions", review:"Revision queue", settings:"Backup & settings" };
    $("page-label").textContent = labels[view] || "Dashboard";
    $("sidebar").classList.remove("open");
    if (view === "questions") renderQuestions();
    if (view === "review") renderReview();
    if (view === "settings") updateStorageInfo();
  }
  function openQuestionModal(question = null) {
    $("question-form").reset();
    $("edit-id").value = question?.id || "";
    $("modal-title").textContent = question ? "Edit question" : "Add a question";
    $("save-question").textContent = question ? "Update question" : "Save question";
    $("question-category").innerHTML = categoryOptions(question?.category || activeCategory || categories[0]);
    $("question-text").value = question?.question || "";
    $("question-difficulty").value = question?.difficulty || "Intermediate";
    $("question-status").value = question?.status || "Not Started";
    $("question-tags").value = (question?.tags || []).join(", ");
    $("question-answer").value = question?.answer || "";
    $("question-example").value = question?.example || "";
    $("question-modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    setTimeout(() => $("question-text").focus(), 40);
  }
  function closeModal() {
    $("question-modal").classList.add("hidden");
    document.body.style.overflow = "";
  }
  function submitQuestion(event) {
    event.preventDefault();
    const id = $("edit-id").value;
    const existing = questions.find(q => q.id === id);
    const question = {
      id: id || makeId(),
      question: $("question-text").value.trim(),
      category: $("question-category").value,
      difficulty: $("question-difficulty").value,
      status: $("question-status").value,
      tags: $("question-tags").value.split(",").map(t => t.trim()).filter(Boolean),
      answer: $("question-answer").value.trim(),
      example: $("question-example").value.trim(),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!question.question) return;
    if (existing) questions = questions.map(q => q.id === id ? question : q);
    else questions.unshift(question);
    if (save()) {
      closeModal();
      renderAll();
      notify(existing ? "Question updated." : "Question saved.");
    }
  }
  function statusClass(status) {
    return status === "Completed" ? "completed" : status === "Learning" ? "learning" : "not-started";
  }
  function questionCard(q, compact = false) {
    const safeId = escapeHtml(q.id);
    const tags = (q.tags || []).map(t => `<span class="chip">#${escapeHtml(t)}</span>`).join("");
    const answer = q.answer ? `<div class="answer-block"><h4>ANSWER / EXPLANATION</h4><p>${escapeHtml(q.answer)}</p></div>` : `<div class="answer-block"><h4>ANSWER / EXPLANATION</h4><p class="muted">No answer added yet. Edit this question to add one.</p></div>`;
    const example = q.example ? `<div class="answer-block"><h4>CODE / PRACTICAL EXAMPLE / NOTES</h4><pre>${escapeHtml(q.example)}</pre></div>` : "";
    return `<article class="question-card" data-card="${safeId}">
      <div class="question-card-top"><div class="chips"><span class="chip category-chip">${escapeHtml(q.category)}</span><span class="chip">${escapeHtml(q.difficulty || "Intermediate")}</span>${tags}</div><span class="chip status-chip ${statusClass(q.status)}">${escapeHtml(q.status || "Not Started")}</span></div>
      <h3 class="question-title">${escapeHtml(q.question)}</h3>
      ${compact ? "" : `<p class="question-preview">${escapeHtml((q.answer || "").slice(0, 155))}${(q.answer || "").length > 155 ? "…" : ""}</p>`}
      <div class="question-meta"><small>Updated ${formatDate(q.updatedAt || q.createdAt)}</small><div class="card-actions">
        <button class="mini-button" data-action="toggle" data-id="${safeId}">View answer</button>
        <button class="mini-button" data-action="edit" data-id="${safeId}">Edit</button>
        <button class="mini-button delete" data-action="delete" data-id="${safeId}">Delete</button>
      </div></div>
      <div class="card-expanded">${answer}${example}
        <div class="inline-status"><label for="status-${safeId}">Preparation status</label><select id="status-${safeId}" data-action="status" data-id="${safeId}">${["Not Started","Learning","Completed"].map(s => `<option ${q.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
    </article>`;
  }
  function formatDate(value) {
    if (!value) return "recently";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "recently" : date.toLocaleDateString(undefined, {day:"numeric",month:"short",year:"numeric"});
  }
  function getFiltered() {
    const term = $("search-input").value.trim().toLowerCase();
    const status = $("filter-status").value;
    const difficulty = $("filter-difficulty").value;
    const sort = $("sort-by").value;
    let result = questions.filter(q => {
      const matchesCategory = !activeCategory || q.category === activeCategory;
      const matchesStatus = !status || q.status === status;
      const matchesDifficulty = !difficulty || q.difficulty === difficulty;
      const searchable = [q.question,q.answer,q.example,q.category,...(q.tags || [])].join(" ").toLowerCase();
      return matchesCategory && matchesStatus && matchesDifficulty && (!term || searchable.includes(term));
    });
    result.sort((a,b) => sort === "az" ? a.question.localeCompare(b.question)
      : sort === "created" ? new Date(b.createdAt) - new Date(a.createdAt)
      : new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    return result;
  }
  function renderQuestions() {
    const result = getFiltered();
    $("questions-title").textContent = activeCategory || "All questions";
    $("results-count").textContent = `${result.length} question${result.length === 1 ? "" : "s"}`;
    $("question-list").innerHTML = result.map(q => questionCard(q)).join("");
    $("questions-empty").classList.toggle("hidden", result.length > 0);
    $("question-list").classList.toggle("hidden", result.length === 0);
  }
  function renderReview() {
    const result = questions.filter(q => q.status !== "Completed").sort((a,b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    $("review-count").textContent = result.length;
    $("review-list").innerHTML = result.map(q => questionCard(q)).join("");
    $("review-empty").classList.toggle("hidden", result.length > 0);
    $("review-list").classList.toggle("hidden", result.length === 0);
  }
  function renderDashboard() {
    const total = questions.length;
    const completed = questions.filter(q => q.status === "Completed").length;
    const learning = questions.filter(q => q.status === "Learning").length;
    const fresh = total - completed - learning;
    $("stat-total").textContent = total;
    $("stat-learning").textContent = learning + fresh;
    $("stat-completed").textContent = completed;
    $("stat-categories").textContent = new Set(questions.map(q => q.category)).size;
    const percent = total ? Math.round(completed / total * 100) : 0;
    $("progress-percent").textContent = `${percent}%`;
    $("progress-fill").style.width = `${percent}%`;
    $("legend-completed").textContent = completed;
    $("legend-learning").textContent = learning;
    $("legend-new").textContent = fresh;
    const recent = [...questions].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,4);
    $("recent-list").innerHTML = recent.map(q => questionCard(q,true)).join("");
    $("recent-empty").classList.toggle("hidden", total > 0);
    $("recent-list").classList.toggle("hidden", total === 0);
  }
  function renderAll() {
    renderCategoryNav();
    renderDashboard();
    renderQuestions();
    renderReview();
    updateStorageInfo();
  }
  function exportBackup() {
    const data = { app: "Interview Prep Hub", version: 1, exportedAt: new Date().toISOString(), categories, questions };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `interview-prep-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    notify("Backup downloaded.");
  }
  async function importBackup(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.questions;
      if (!Array.isArray(incoming) || !incoming.every(q => q && typeof q.question === "string")) throw new Error("Invalid format");
      const merge = new Map(questions.map(q => [q.id, q]));
      incoming.forEach(q => merge.set(q.id || makeId(), {...q, id:q.id || makeId()}));
      questions = [...merge.values()];
      if (Array.isArray(data.categories)) categories = [...new Set([...DEFAULT_CATEGORIES,...data.categories.filter(c => typeof c === "string")])];
      save(); renderAll(); notify(`Imported ${incoming.length} question${incoming.length === 1 ? "" : "s"}.`);
    } catch (error) {
      alert("This file could not be imported. Please choose a valid Interview Prep Hub JSON backup.");
    } finally { $("import-file").value = ""; }
  }
  function handleCardAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    const q = questions.find(item => item.id === id);
    if (!q) return;
    if (button.dataset.action === "toggle") {
      const card = button.closest(".question-card");
      card.classList.toggle("expanded");
      button.textContent = card.classList.contains("expanded") ? "Hide answer" : "View answer";
    } else if (button.dataset.action === "edit") openQuestionModal(q);
    else if (button.dataset.action === "delete") {
      if (confirm("Delete this question? This cannot be undone unless you have a backup.")) {
        questions = questions.filter(item => item.id !== id);
        save(); renderAll(); notify("Question deleted.");
      }
    }
  }
  function handleStatusChange(event) {
    const select = event.target.closest('select[data-action="status"]');
    if (!select) return;
    const q = questions.find(item => item.id === select.dataset.id);
    if (q) {
      q.status = select.value; q.updatedAt = new Date().toISOString();
      save(); renderAll(); notify("Preparation status updated.");
    }
  }
  function addCategory() {
    const value = prompt("Enter a new category name:");
    if (!value || !value.trim()) return;
    const name = value.trim();
    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) return notify("That category already exists.");
    categories.push(name); save(); renderCategoryNav(); $("question-category").innerHTML = categoryOptions(name); notify("Category added.");
  }
  function bindEvents() {
    document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => { activeCategory = ""; showView(button.dataset.view); }));
    document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => { activeCategory = ""; showView(button.dataset.go); }));
    $("category-nav").addEventListener("click", event => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      activeCategory = button.dataset.category;
      showView("questions");
      renderCategoryNav();
    });
    ["top-add","dashboard-add","quick-add","empty-add","questions-add","no-results-add"].forEach(id => $(id).addEventListener("click", () => openQuestionModal()));
    $("quick-review").addEventListener("click", () => showView("review"));
    $("top-export").addEventListener("click", exportBackup);
    $("settings-export").addEventListener("click", exportBackup);
    $("question-form").addEventListener("submit", submitQuestion);
    document.querySelectorAll(".close-modal").forEach(button => button.addEventListener("click", closeModal));
    $("question-modal").addEventListener("click", event => { if (event.target === $("question-modal")) closeModal(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !$("question-modal").classList.contains("hidden")) closeModal(); });
    $("question-list").addEventListener("click", handleCardAction);
    $("recent-list").addEventListener("click", handleCardAction);
    $("review-list").addEventListener("click", handleCardAction);
    ["question-list","recent-list","review-list"].forEach(id => $(id).addEventListener("change", handleStatusChange));
    ["search-input","filter-status","filter-difficulty","sort-by"].forEach(id => $(id).addEventListener(id === "search-input" ? "input" : "change", renderQuestions));
    $("clear-filters").addEventListener("click", () => {
      $("search-input").value = ""; $("filter-status").value = ""; $("filter-difficulty").value = ""; $("sort-by").value = "updated"; activeCategory = ""; renderAll();
    });
    $("add-category").addEventListener("click", addCategory);
    $("import-file").addEventListener("change", event => importBackup(event.target.files[0]));
    $("delete-all").addEventListener("click", () => {
      if (confirm("Delete ALL questions and custom categories from this browser? Export a backup first if you need this data.")) {
        questions = []; categories = [...DEFAULT_CATEGORIES]; activeCategory = ""; save(); renderAll(); notify("Your question bank has been cleared.");
      }
    });
    $("menu-toggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));
    $("auth-form").addEventListener("submit", handleAuthSubmit);
    $("auth-mode-toggle").addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));
    $("sign-out").addEventListener("click", async () => { if (supabaseClient) await supabaseClient.auth.signOut(); });
  }
  load();
  bindEvents();
  renderAll();
  bootstrapCloud();
})();