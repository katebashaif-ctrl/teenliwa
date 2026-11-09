import React, { useMemo, useState } from "react";
import type { Product, ProductCategory } from "../types/store";
import { Check, ImagePlus, Package, Save, Upload, X } from "lucide-react";

type ProductFormData = Omit<Product, "id">;

interface ProductFormModalProps {
  product?: Product | null;
  onClose: () => void;
  onSave: (product: ProductFormData) => Promise<boolean>;
}

const categories: Array<{ value: ProductCategory; label: string }> = [
  { value: "rutab", label: "الرطب" },
  { value: "dates", label: "التمور" },
  { value: "fig", label: "التين" },
  { value: "faqa", label: "الفقع" },
  { value: "truffle", label: "الفقع الفاخر" },
  { value: "nuts", label: "المكسرات" },
  { value: "fruits", label: "الفواكه" },
  { value: "boxes", label: "صناديق الإهداء" },
];

const imageOptions = [
  { label: "تين أحمر طازج", url: "/images/redfig.jpg" },
  { label: "تين أصفر طازج", url: "/images/yellowfig.jpg" },
  { label: "تمر سكري", url: "/images/tmr_sokry.webp" },
  { label: "فقع فاخر", url: "/images/fq3.jpg" },
  { label: "تمر صقعي", url: "/images/tmr_saq3y.webp" },
  { label: "تمر خلاص", url: "/images/tmr_ikhlas.webp" },
  { label: "تمر شيشي", url: "/images/tmr_shishi.webp" },
  { label: "تمر صفوي", url: "/images/tmr_safaye.webp" },
  { label: "لوز محلي", url: "/images/lowzlocal.jpg" },
  { label: "لوز جامبو", url: "/images/lowz.jpg" },
  { label: "توت طويل", url: "/images/tot.webp" },
  { label: "صبار طازج", url: "/images/sabars.webp" },
  { label: "كنار", url: "/images/kanar.webp" },
];

const inputClass =
  "w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-amber-800 focus:ring-2 focus:ring-amber-800/10";
const labelClass = "mb-1.5 block text-xs font-bold text-stone-700";

function makeInitialProduct(product?: Product | null): ProductFormData {
  if (product) {
    return {
      ...product,
      sku: product.sku || "",
      nameEn: product.nameEn || "",
      unit: product.unit || "item",
      origin: product.origin || "",
      harvestDate: product.harvestDate || "",
      season: product.season || "",
      image: product.image || "",
      description: product.description || "",
      desc: product.desc || "",
      tag: product.tag || "",
      badge: product.badge || "",
      minQty: product.minQty ?? 1,
      maxQty: product.maxQty ?? 50,
      inStock: product.inStock,
      stockQuantity: product.stockQuantity ?? 0,
      trackInventory: product.trackInventory ?? product.stockQuantity !== undefined,
      isActive: product.isActive ?? product.disabled !== 1,
      isAvailable: product.isAvailable ?? product.inStock,
      sortOrder: product.sortOrder ?? 0,
      featured: product.featured ?? false,
      tastingNotes: product.tastingNotes || [],
      storageInstructions: product.storageInstructions || "",
    };
  }

  return {
    name: "",
    nameEn: "",
    sku: "",
    category: "rutab",
    price: 0,
    originalPrice: undefined,
    unit: "سحارة خشبية ٢ كجم",
    origin: "مزارع ليوا - واحات الظفرة",
    harvestDate: "",
    season: "",
    image: "",
    description: "",
    desc: "",
    tag: "",
    disabled: 0,
    disabledTxt: "متوفر",
    minQty: 1,
    maxQty: 50,
    tastingNotes: [],
    storageInstructions: "",
    inStock: true,
    stockQuantity: 30,
    trackInventory: true,
    isActive: true,
    isAvailable: true,
    sortOrder: 0,
    badge: "",
    featured: false,
  };
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<ProductFormData>(() => makeInitialProduct(product));
  const [tastingNotesText, setTastingNotesText] = useState(
    () => (product?.tastingNotes || []).join(", "),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditing = Boolean(product);

  const previewImage = useMemo(() => form.image || "", [form.image]);

  const setField = <K extends keyof ProductFormData>(
    key: K,
    value: ProductFormData[K],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setError("");
  };

  const handleImageFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("اختر ملف صورة صالحاً.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة يجب ألا يتجاوز 5 ميغابايت.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setField("image", reader.result);
    };
    reader.onerror = () => setError("تعذرت قراءة ملف الصورة.");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const name = String(form.name || "").trim();
    const price = Number(form.price);
    const minimum = Number(form.minQty ?? 1);
    const maximum = Number(form.maxQty ?? 50);
    const stock = Number(form.stockQuantity ?? 0);
    const originalPrice = form.originalPrice == null ? undefined : Number(form.originalPrice);

    if (!name) return setError("اسم المنتج بالعربية مطلوب.");
    if (name.length > 200) return setError("اسم المنتج يجب ألا يتجاوز 200 حرف.");
    if (!Number.isFinite(price) || price < 0) return setError("أدخل سعراً صحيحاً بالدرهم الإماراتي.");
    if (originalPrice !== undefined && (!Number.isFinite(originalPrice) || originalPrice < price)) {
      return setError("السعر قبل الخصم يجب أن يكون أكبر من أو مساوياً للسعر الحالي.");
    }
    if (!Number.isSafeInteger(minimum) || minimum < 1) return setError("الحد الأدنى للطلب يجب أن يكون عدداً صحيحاً يبدأ من 1.");
    if (!Number.isSafeInteger(maximum) || maximum < minimum) return setError("الحد الأعلى يجب أن يكون عدداً صحيحاً وألا يقل عن الحد الأدنى.");
    if (form.trackInventory && (!Number.isSafeInteger(stock) || stock < 0)) {
      return setError("كمية المخزون يجب أن تكون صفراً أو عدداً صحيحاً موجباً.");
    }
    if (!Number.isSafeInteger(Number(form.sortOrder ?? 0)) || Number(form.sortOrder ?? 0) < 0) {
      return setError("ترتيب العرض يجب أن يكون عدداً صحيحاً غير سالب.");
    }

    const normalized: ProductFormData = {
      ...form,
      name,
      nameEn: String(form.nameEn || "").trim() || undefined,
      sku: String(form.sku || "").trim() || undefined,
      category: form.category,
      price,
      originalPrice,
      unit: String(form.unit || "").trim() || "item",
      origin: String(form.origin || "").trim() || undefined,
      harvestDate: String(form.harvestDate || "").trim() || undefined,
      season: String(form.season || "").trim() || undefined,
      image: String(form.image || "").trim(),
      description: String(form.description || "").trim(),
      desc: String(form.desc || "").trim() || undefined,
      tag: String(form.tag || "").trim() || undefined,
      badge: String(form.badge || "").trim() || undefined,
      minQty: minimum,
      maxQty: maximum,
      trackInventory: Boolean(form.trackInventory),
      stockQuantity: form.trackInventory ? stock : undefined,
      isActive: Boolean(form.isActive),
      isAvailable: Boolean(form.isAvailable),
      inStock: Boolean(form.isActive && form.isAvailable && (!form.trackInventory || stock > 0)),
      disabled: form.isActive ? 0 : 1,
      disabledTxt: form.isAvailable ? (form.disabledTxt || "متوفر") : (form.disabledTxt || "غير متوفر"),
      featured: Boolean(form.featured),
      sortOrder: Number(form.sortOrder ?? 0),
      tastingNotes: tastingNotesText.split(/[\n,،]/).map((item) => item.trim()).filter(Boolean).slice(0, 12),
      storageInstructions: String(form.storageInstructions || "").trim(),
    };

    setIsSaving(true);
    try {
      const saved = await onSave(normalized);
      if (saved) onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر حفظ المنتج.");
    } finally {
      setIsSaving(false);
    }
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="border-b border-stone-200 pb-2">
      <h4 className="text-sm font-black text-[#2C2014]">{children}</h4>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-2 backdrop-blur-sm sm:p-5" dir="rtl">
      <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[#D6BE9F] bg-[#FCFAF6] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#E8DCCB] bg-white px-4 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2C2014] text-amber-300">
              <Package className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black text-[#2C2014]">
                {isEditing ? "تعديل بيانات المنتج" : "إضافة محصول / صنف جديد"}
              </h3>
              <p className="text-xs text-stone-500">
                الحقول مرتبطة بأعمدة قاعدة بيانات D1 v2
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-xl p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-7 p-4 sm:p-7">
            {error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                {error}
              </div>
            )}

            <section className="space-y-4">
              <SectionTitle>1. بيانات المنتج الأساسية</SectionTitle>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>اسم المنتج بالعربية *</label>
                  <input className={inputClass} type="text" required maxLength={200} value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="مثال: رطب خلاص ليوا الفاخر" />
                  <p className="mt-1 text-[10px] text-stone-400">مطلوب — بحد أقصى 200 حرف (products.name)</p>
                </div>
                <div>
                  <label className={labelClass}>الاسم بالإنجليزية</label>
                  <input className={inputClass} type="text" maxLength={200} value={form.nameEn || ""} onChange={(e) => setField("nameEn", e.target.value)} dir="ltr" placeholder="Premium Liwa Rutab" />
                  <p className="mt-1 text-[10px] text-stone-400">products.name_en</p>
                </div>
                <div>
                  <label className={labelClass}>رمز المنتج SKU</label>
                  <input className={inputClass + " font-mono"} type="text" maxLength={80} value={form.sku || ""} onChange={(e) => setField("sku", e.target.value.toUpperCase())} dir="ltr" placeholder="TL-RUT-001" />
                  <p className="mt-1 text-[10px] text-stone-400">اختياري وفريد — products.sku</p>
                </div>
                <div>
                  <label className={labelClass}>التصنيف *</label>
                  <select className={inputClass} value={form.category} onChange={(e) => setField("category", e.target.value as ProductCategory)}>
                    {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                  <p className="mt-1 text-[10px] text-stone-400">يُربط بمعرّف التصنيف عبر categories.slug</p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <SectionTitle>2. التسعير وحدود الطلب</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={labelClass}>السعر الحالي (AED) *</label>
                  <input className={inputClass + " font-bold tabular-nums"} type="number" inputMode="decimal" min="0" step="0.01" required value={form.price} onChange={(e) => setField("price", Number(e.target.value))} />
                  <p className="mt-1 text-[10px] text-stone-400">يُحفظ كفلس صحيح — price_fils</p>
                </div>
                <div>
                  <label className={labelClass}>السعر قبل الخصم (AED)</label>
                  <input className={inputClass + " tabular-nums"} type="number" inputMode="decimal" min={form.price} step="0.01" value={form.originalPrice ?? ""} onChange={(e) => setField("originalPrice", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="اختياري" />
                  <p className="mt-1 text-[10px] text-stone-400">يجب ألا يقل عن السعر الحالي</p>
                </div>
                <div>
                  <label className={labelClass}>أقل كمية للطلب *</label>
                  <input className={inputClass} type="number" min="1" step="1" required value={form.minQty ?? 1} onChange={(e) => setField("minQty", Number(e.target.value))} />
                  <p className="mt-1 text-[10px] text-stone-400">minimum_order_quantity</p>
                </div>
                <div>
                  <label className={labelClass}>أعلى كمية للطلب *</label>
                  <input className={inputClass} type="number" min={form.minQty ?? 1} step="1" required value={form.maxQty ?? 50} onChange={(e) => setField("maxQty", Number(e.target.value))} />
                  <p className="mt-1 text-[10px] text-stone-400">maximum_order_quantity</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>وحدة البيع والتعبئة</label>
                  <input className={inputClass} type="text" maxLength={80} value={form.unit || ""} onChange={(e) => setField("unit", e.target.value)} placeholder="سحارة خشبية ٢ كجم / كيلو / صندوق" />
                </div>
                <div>
                  <label className={labelClass}>ترتيب العرض</label>
                  <input className={inputClass} type="number" min="0" step="1" value={form.sortOrder ?? 0} onChange={(e) => setField("sortOrder", Number(e.target.value))} />
                  <p className="mt-1 text-[10px] text-stone-400">sort_order — الأصغر يظهر أولاً</p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <SectionTitle>3. المخزون والنشر</SectionTitle>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4">
                  <input className="mt-1 h-4 w-4" type="checkbox" checked={Boolean(form.trackInventory)} onChange={(e) => setField("trackInventory", e.target.checked)} />
                  <span><strong className="block text-sm text-stone-800">تتبع المخزون</strong><small className="text-[11px] text-stone-500">track_inventory</small></span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4">
                  <input className="mt-1 h-4 w-4" type="checkbox" checked={Boolean(form.isActive)} onChange={(e) => setField("isActive", e.target.checked)} />
                  <span><strong className="block text-sm text-stone-800">نشر المنتج في المتجر</strong><small className="text-[11px] text-stone-500">is_active</small></span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4">
                  <input className="mt-1 h-4 w-4" type="checkbox" checked={Boolean(form.isAvailable)} onChange={(e) => setField("isAvailable", e.target.checked)} />
                  <span><strong className="block text-sm text-stone-800">السماح بطلب المنتج</strong><small className="text-[11px] text-stone-500">is_available</small></span>
                </label>
              </div>
              {form.trackInventory && (
                <div className="max-w-sm">
                  <label className={labelClass}>الكمية الحالية في المخزون *</label>
                  <input className={inputClass + " font-bold tabular-nums"} type="number" min="0" step="1" required value={form.stockQuantity ?? 0} onChange={(e) => setField("stockQuantity", Number(e.target.value))} />
                  <p className="mt-1 text-[10px] text-stone-400">stock_quantity — صفر يعني لا توجد كمية متاحة</p>
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <input className="h-4 w-4" type="checkbox" checked={Boolean(form.featured)} onChange={(e) => setField("featured", e.target.checked)} />
                <span><strong className="block text-sm text-amber-950">تمييز المنتج في الواجهة</strong><small className="text-[11px] text-amber-800">is_featured</small></span>
              </label>
              <div>
                <label className={labelClass}>نص حالة التوفر الظاهر للعميل</label>
                <input className={inputClass} type="text" maxLength={80} value={form.disabledTxt || ""} onChange={(e) => setField("disabledTxt", e.target.value)} placeholder="متوفر / قريباً / موسم محدود" />
              </div>
            </section>

            <section className="space-y-4">
              <SectionTitle>4. المنشأ والموسم والتصنيف التسويقي</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelClass}>المصدر / المزرعة</label>
                  <input className={inputClass} type="text" maxLength={160} value={form.origin || ""} onChange={(e) => setField("origin", e.target.value)} placeholder="مزارع ليوا - واحات الظفرة" />
                </div>
                <div>
                  <label className={labelClass}>تاريخ / وصف القطاف</label>
                  <input className={inputClass} type="text" maxLength={80} value={form.harvestDate || ""} onChange={(e) => setField("harvestDate", e.target.value)} placeholder="مثال: قطاف اليوم أو 2026-11-09" />
                </div>
                <div>
                  <label className={labelClass}>الموسم</label>
                  <input className={inputClass} type="text" maxLength={80} value={form.season || ""} onChange={(e) => setField("season", e.target.value)} placeholder="موسم القيظ" />
                </div>
                <div>
                  <label className={labelClass}>وسم المنتج (Tag)</label>
                  <input className={inputClass} type="text" maxLength={80} value={form.tag || ""} onChange={(e) => setField("tag", e.target.value)} placeholder="fresh / premium / seasonal" />
                </div>
                <div>
                  <label className={labelClass}>شارة العرض (Badge)</label>
                  <input className={inputClass} type="text" maxLength={80} value={form.badge || ""} onChange={(e) => setField("badge", e.target.value)} placeholder="قطاف جديد / الأكثر طلباً" />
                </div>
                <div>
                  <label className={labelClass}>تعليمات التخزين</label>
                  <input className={inputClass} type="text" maxLength={240} value={form.storageInstructions || ""} onChange={(e) => setField("storageInstructions", e.target.value)} placeholder="يحفظ مبرداً..." />
                </div>
              </div>
              <div>
                <label className={labelClass}>ملاحظات المذاق (افصل بينها بفاصلة)</label>
                <input className={inputClass} type="text" maxLength={500} value={tastingNotesText} onChange={(e) => setTastingNotesText(e.target.value)} placeholder="حلو، طازج، نكهة غنية" />
                <p className="mt-1 text-[10px] text-stone-400">تُحفظ ضمن details_json.tastingNotes</p>
              </div>
            </section>

            <section className="space-y-4">
              <SectionTitle>5. الصورة والوصف</SectionTitle>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#D6BE9F] bg-[#F5EFE6]">
                    {previewImage ? <img src={previewImage} alt="معاينة المنتج" className="h-full w-full object-contain p-3" /> : <ImagePlus className="h-10 w-10 text-amber-800/50" />}
                  </div>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#2C2014] px-3 py-2.5 text-xs font-bold text-amber-100 hover:bg-black">
                    <Upload className="h-4 w-4" />
                    <span>اختيار صورة (حتى 5MB)</span>
                    <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageFile} />
                  </label>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>رابط الصورة أو مسار R2</label>
                    <input className={inputClass + " font-mono text-xs"} type="text" dir="ltr" maxLength={1000} value={form.image || ""} onChange={(e) => setField("image", e.target.value)} placeholder="/api/r2?key=products/..." />
                    <p className="mt-1 text-[10px] text-stone-400">image_url — ترفع الصور المختارة إلى R2 عند حفظ النموذج</p>
                  </div>
                  <div>
                    <label className={labelClass}>اختر من الصور الجاهزة</label>
                    <div className="grid max-h-36 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-stone-200 bg-white p-2 sm:grid-cols-3">
                      {imageOptions.map((option) => (
                        <button type="button" key={option.url} onClick={() => setField("image", option.url)} className={`flex items-center gap-2 rounded-lg border p-1.5 text-right text-[10px] ${form.image === option.url ? "border-amber-800 bg-amber-50" : "border-stone-200 hover:bg-stone-50"}`}>
                          <img src={option.url} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                          <span className="truncate">{option.label}</span>
                          {form.image === option.url && <Check className="h-3 w-3 shrink-0 text-emerald-700" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>وصف المنتج الكامل</label>
                  <textarea className={inputClass} rows={4} maxLength={5000} value={form.description || ""} onChange={(e) => setField("description", e.target.value)} placeholder="وصف المحصول ومصدره وطريقة تقديمه..." />
                  <p className="mt-1 text-[10px] text-stone-400">products.description</p>
                </div>
                <div>
                  <label className={labelClass}>وصف مختصر للبطاقة</label>
                  <textarea className={inputClass} rows={4} maxLength={500} value={form.desc || ""} onChange={(e) => setField("desc", e.target.value)} placeholder="عبارة قصيرة تظهر في بطاقة المنتج..." />
                  <p className="mt-1 text-[10px] text-stone-400">details_json.desc</p>
                </div>
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[#E8DCCB] bg-white/95 px-4 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-[10px] text-stone-400">السعر يُحوّل إلى fils، والمخزون وحالة النشر تحفظ في أعمدة D1 المحددة.</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-stone-300 px-5 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50">إلغاء</button>
              <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2C2014] px-6 py-2.5 text-xs font-black text-amber-100 shadow hover:bg-black disabled:cursor-wait disabled:opacity-60">
                {isSaving ? <span className="animate-pulse">جاري الحفظ...</span> : <><Save className="h-4 w-4" /><span>{isEditing ? "حفظ بيانات المنتج" : "إضافة المنتج إلى قاعدة البيانات"}</span></>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
