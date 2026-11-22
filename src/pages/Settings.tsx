import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getSettings,
  saveSettings,
  getUsers,
  saveUser,
  deleteUser,
  resetToDemoData,
  exportAllData,
  importAllData,
} from '../lib/store';
import { Settings as SettingsType, User as UserType, UserRole } from '../types';
import {
  Settings as SettingsIcon,
  Palette,
  Building,
  Users,
  ListPlus,
  Trash2,
  Plus,
  Save,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Shield,
  KeyRound,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettingsState] = useState<SettingsType>(getSettings());
  const [usersList, setUsersList] = useState<UserType[]>(getUsers());

  // Feedback states
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Agent Form modal / inline state
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [newAgentUsername, setNewAgentUsername] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newAgentFullName, setNewAgentFullName] = useState('');
  const [newAgentRole, setNewAgentRole] = useState<UserRole>('agent');
  const [newAgentBadge, setNewAgentBadge] = useState('');

  // New list items state
  const [newViolationType, setNewViolationType] = useState('');
  const [newActionType, setNewActionType] = useState('');

  // Handle general settings updates
  const handleSettingsChange = (field: keyof SettingsType, value: any) => {
    const updated = { ...settings, [field]: value };
    setSettingsState(updated);
    saveSettings(updated);
  };

  const handleSaveAll = () => {
    saveSettings(settings);
    setSaveSuccess('تم حفظ وتطبيق كافة الإعدادات بنجاح فوراً عبر كامل التطبيق');
    setTimeout(() => setSaveSuccess(null), 4000);
  };

  // Add violation type
  const handleAddViolationType = () => {
    const val = newViolationType.trim();
    if (!val) return;
    if (settings.violationTypes.includes(val)) {
      alert('هذا الصنف موجود مسبقاً');
      return;
    }
    const updatedTypes = [...settings.violationTypes, val];
    handleSettingsChange('violationTypes', updatedTypes);
    setNewViolationType('');
  };

  const handleDeleteViolationType = (index: number) => {
    const updatedTypes = settings.violationTypes.filter((_, i) => i !== index);
    handleSettingsChange('violationTypes', updatedTypes);
  };

  // Add action type
  const handleAddActionType = () => {
    const val = newActionType.trim();
    if (!val) return;
    if (settings.actionTypes.includes(val)) {
      alert('هذا الإجراء موجود مسبقاً');
      return;
    }
    const updatedActions = [...settings.actionTypes, val];
    handleSettingsChange('actionTypes', updatedActions);
    setNewActionType('');
  };

  const handleDeleteActionType = (index: number) => {
    const updatedActions = settings.actionTypes.filter((_, i) => i !== index);
    handleSettingsChange('actionTypes', updatedActions);
  };

  // Agent Management
  const handleCreateAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentUsername.trim() || !newAgentPassword.trim() || !newAgentFullName.trim()) {
      alert('يرجى ملء جميع حقول العون الجديد');
      return;
    }

    const newAgent: UserType = {
      username: newAgentUsername.trim().toLowerCase(),
      password: newAgentPassword.trim(),
      fullName: newAgentFullName.trim(),
      role: newAgentRole,
      badgeNumber: newAgentBadge.trim() || undefined,
    };

    saveUser(newAgent);
    setUsersList(getUsers());
    setShowAddAgent(false);
    setNewAgentUsername('');
    setNewAgentPassword('');
    setNewAgentFullName('');
    setNewAgentBadge('');
    setSaveSuccess('تمت إضافة العون الجديد بنجاح');
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  const handleDeleteAgent = (username: string) => {
    if (username === user?.username) {
      alert('لا يمكنك حذف حسابك المتصل به حالياً');
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف حساب العون: ${username}؟`)) {
      deleteUser(username);
      setUsersList(getUsers());
    }
  };

  // Data management
  const handleResetDemo = () => {
    if (
      window.confirm(
        'تنبيه: سيتم استرجاع البيانات التجريبية الافتراضية وحذف أي تعديلات محلية. هل تريد المتابعة؟'
      )
    ) {
      resetToDemoData();
      setSettingsState(getSettings());
      setUsersList(getUsers());
      setSaveSuccess('تمت إعادة ضبط البيانات الافتراضية بنجاح');
      setTimeout(() => setSaveSuccess(null), 3000);
    }
  };

  const handleExportData = () => {
    const json = exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `police_municipale_backup_${settings.municipalityCode}_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = importAllData(content);
        if (ok) {
          setSettingsState(getSettings());
          setUsersList(getUsers());
          setSaveSuccess('تم استيراد البيانات والنسخة الاحتياطية بنجاح!');
          setTimeout(() => setSaveSuccess(null), 3000);
        } else {
          setErrorMsg('فشل استيراد الملف، تأكد من صحة تنسيق JSON.');
          setTimeout(() => setErrorMsg(null), 4000);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            <span>إعدادات المنظومة</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            لوحة تحكم رئيس المركز — تخصيص الهوية، الأعوان، والأصناف
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow hover:opacity-90 active:scale-95 flex items-center gap-1.5 touch-target"
        >
          <Save className="w-4 h-4" />
          <span>حفظ التغييرات</span>
        </button>
      </div>

      {/* Success / Error Alerts */}
      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-bold">{saveSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 animate-shake">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="font-bold">{errorMsg}</span>
        </div>
      )}

      {/* SECTION 1: IDENTITY & MUNICIPALITY */}
      <section className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
          <Building className="w-4 h-4 text-primary" />
          <span>1. بيانات الهوية المؤسساتية والبلدية</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم التطبيق</label>
            <input
              type="text"
              value={settings.appName}
              onChange={(e) => handleSettingsChange('appName', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم البلدية</label>
            <input
              type="text"
              value={settings.municipalityName}
              onChange={(e) => handleSettingsChange('municipalityName', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              رمز البلدية في محاضر المخالفات (3-4 أحرف لاتينية)
            </label>
            <input
              type="text"
              maxLength={6}
              value={settings.municipalityCode}
              onChange={(e) => handleSettingsChange('municipalityCode', e.target.value.toUpperCase())}
              placeholder="SIDI"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              يُستعمل في المرجع الفني للمخالفات، مثال: 2026-{settings.municipalityCode || 'MUN'}-0001
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">العنوان الفرعي للمنظومة</label>
            <input
              type="text"
              value={settings.appSubtitle}
              onChange={(e) => handleSettingsChange('appSubtitle', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </section>

      {/* SECTION 2: THEME COLORS (Live CSS variables injection) */}
      <section className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
          <Palette className="w-4 h-4 text-primary" />
          <span>2. ألوان واجهة الاستخدام (تطبيق فوري مباشر)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Primary Color Picker */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              اللون الأساسي المؤسساتي (Primary)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.primaryHex}
                onChange={(e) => handleSettingsChange('primaryHex', e.target.value)}
                className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 bg-white"
              />
              <span className="font-mono text-xs font-bold text-slate-700">
                {settings.primaryHex}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">أشرطة العناوين، الأزرار الرئيسية، والأيقونات.</p>
          </div>

          {/* Success Color Picker */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              لون التأكيد والنجاح (Success)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.successHex}
                onChange={(e) => handleSettingsChange('successHex', e.target.value)}
                className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 bg-white"
              />
              <span className="font-mono text-xs font-bold text-slate-700">
                {settings.successHex}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">أزرار الحفظ الإيجابي وشارات الإجراءات السليمة.</p>
          </div>

          {/* Destructive Color Picker */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              لون التنبيه والإنذار (Destructive)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.destructiveHex}
                onChange={(e) => handleSettingsChange('destructiveHex', e.target.value)}
                className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 bg-white"
              />
              <span className="font-mono text-xs font-bold text-slate-700">
                {settings.destructiveHex}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">شارات المخالفين المتكررين وأزرار الحذف.</p>
          </div>
        </div>
      </section>

      {/* SECTION 3: AGENTS MANAGEMENT */}
      <section className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span>3. إدارة أعوان ورؤساء الفرق ({usersList.length})</span>
          </h2>
          <button
            type="button"
            onClick={() => setShowAddAgent(!showAddAgent)}
            className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-xl flex items-center gap-1 touch-target"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة عون</span>
          </button>
        </div>

        {/* Add Agent Form */}
        {showAddAgent && (
          <form
            onSubmit={handleCreateAgent}
            className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 animate-fadeIn"
          >
            <h3 className="text-xs font-bold text-slate-800">تسجيل عون جديد بالمنظومة</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  الاسم واللقب الكامل
                </label>
                <input
                  type="text"
                  required
                  value={newAgentFullName}
                  onChange={(e) => setNewAgentFullName(e.target.value)}
                  placeholder="مثال: العون سامي القروي"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  اسم المستخدم (المعرف المهني)
                </label>
                <input
                  type="text"
                  required
                  value={newAgentUsername}
                  onChange={(e) => setNewAgentUsername(e.target.value)}
                  placeholder="مثال: sami"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  required
                  value={newAgentPassword}
                  onChange={(e) => setNewAgentPassword(e.target.value)}
                  placeholder="كلمة المرور"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الرتبة / الصلاحية</label>
                <select
                  value={newAgentRole}
                  onChange={(e) => setNewAgentRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold focus:outline-none"
                >
                  <option value="agent">عون (تسجيل ومعاينة وبحث)</option>
                  <option value="chef">رئيس فرقة (كل ما سبق + تعديل المحاضر)</option>
                  <option value="admin">رئيس مركز (كافة الصلاحيات + الإعدادات)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم الشارة المهنية</label>
                <input
                  type="text"
                  value={newAgentBadge}
                  onChange={(e) => setNewAgentBadge(e.target.value)}
                  placeholder="مثال: SH-5201"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddAgent(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold shadow hover:opacity-90"
              >
                تأكيد الإضافة
              </button>
            </div>
          </form>
        )}

        {/* Agents Table / List */}
        <div className="space-y-2">
          {usersList.map((agent) => (
            <div
              key={agent.username}
              className="bg-slate-50 p-3 rounded-2xl flex items-center justify-between gap-2 border border-slate-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-primary font-bold text-xs">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{agent.fullName}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                        agent.role === 'admin'
                          ? 'bg-yellow-100 text-yellow-800'
                          : agent.role === 'chef'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {agent.role === 'admin'
                        ? 'رئيس مركز'
                        : agent.role === 'chef'
                        ? 'رئيس فرقة'
                        : 'عون'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    المعرف: {agent.username} {agent.badgeNumber && `• الشارة: ${agent.badgeNumber}`}
                  </div>
                </div>
              </div>

              {agent.username !== user?.username && (
                <button
                  type="button"
                  onClick={() => handleDeleteAgent(agent.username)}
                  className="p-2 text-slate-400 hover:text-red-600 rounded-xl"
                  title="حذف العون"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: VIOLATION TYPES LIST */}
      <section className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
          <ListPlus className="w-4 h-4 text-primary" />
          <span>4. قائمة أصناف المخالفات البلدية</span>
        </h2>

        {/* Add Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newViolationType}
            onChange={(e) => setNewViolationType(e.target.value)}
            placeholder="أدخل صنف مخالفة جديد (مثال: إشغال طريق عام بدون ترخيص)"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={handleAddViolationType}
            className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 active:scale-95 touch-target"
          >
            إضافة
          </button>
        </div>

        {/* List */}
        <div className="flex flex-wrap gap-2 pt-1">
          {settings.violationTypes.map((type, idx) => (
            <div
              key={idx}
              className="bg-slate-100 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 flex items-center gap-2"
            >
              <span>{type}</span>
              <button
                type="button"
                onClick={() => handleDeleteViolationType(idx)}
                className="text-slate-400 hover:text-red-600"
                title="حذف الصنف"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5: ACTION TYPES LIST */}
      <section className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
          <ListPlus className="w-4 h-4 text-primary" />
          <span>5. قائمة الإجراءات القانونية المتخذة</span>
        </h2>

        {/* Add Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newActionType}
            onChange={(e) => setNewActionType(e.target.value)}
            placeholder="أدخل إجراء جديد (مثال: غلق فوري)"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={handleAddActionType}
            className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 active:scale-95 touch-target"
          >
            إضافة
          </button>
        </div>

        {/* List */}
        <div className="flex flex-wrap gap-2 pt-1">
          {settings.actionTypes.map((act, idx) => (
            <div
              key={idx}
              className="bg-slate-100 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 flex items-center gap-2"
            >
              <span>{act}</span>
              <button
                type="button"
                onClick={() => handleDeleteActionType(idx)}
                className="text-slate-400 hover:text-red-600"
                title="حذف الإجراء"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 6: DATA MANAGEMENT */}
      <section className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
          <RotateCcw className="w-4 h-4 text-primary" />
          <span>6. إدارة قاعدة البيانات والنسخ الاحتياطي</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={handleExportData}
            className="p-3.5 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-800 text-xs font-bold flex flex-col items-center justify-center gap-2 border border-slate-200 active:scale-95 transition-all touch-target"
          >
            <Download className="w-5 h-5 text-primary" />
            <span>تصدير نسخة احتياطية (JSON)</span>
          </button>

          <label className="p-3.5 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-800 text-xs font-bold flex flex-col items-center justify-center gap-2 border border-slate-200 active:scale-95 transition-all cursor-pointer touch-target">
            <Upload className="w-5 h-5 text-emerald-600" />
            <span>استيراد نسخة احتياطية (JSON)</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>

          <button
            type="button"
            onClick={handleResetDemo}
            className="p-3.5 bg-red-50 hover:bg-red-100 rounded-2xl text-red-700 text-xs font-bold flex flex-col items-center justify-center gap-2 border border-red-200 active:scale-95 transition-all touch-target"
          >
            <RotateCcw className="w-5 h-5 text-red-600" />
            <span>إعادة ضبط البيانات التجريبية الافتراضية</span>
          </button>
        </div>
      </section>
    </div>
  );
};
