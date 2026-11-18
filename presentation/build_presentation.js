import pptxgen from "pptxgenjs";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = path.join(here, "Salon_Management_ICT4D_Presentation.pptx");
const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "DIIC3110 ICT4D group — names to be completed";
pptx.subject = "Salon Management System: a role-based digital booking and business tool";
pptx.title = "Salon Management System | DIIC3110 ICT4D";
pptx.company = "Group assignment";
pptx.lang = "en-LS";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "en-LS",
};
pptx.defineSlideMaster({
  title: "LIGHT",
  background: { color: "F7F6FA" },
  objects: [
    { rect: { x: 0, y: 0, w: 0.16, h: 7.5, line: { color: "6543A3", transparency: 100 }, fill: { color: "6543A3" } } },
    { line: { x: 0.58, y: 7.08, w: 12.2, h: 0, line: { color: "DDD9E5", width: 0.8 } } },
    { text: { text: "SALON MANAGEMENT SYSTEM  ·  DIIC3110 ICT4D", options: { x: 0.62, y: 7.16, w: 7, h: 0.15, fontFace: "Aptos", fontSize: 8, color: "6B6673", margin: 0, breakLine: false } } },
  ],
  slideNumber: { x: 12.35, y: 7.13, color: "6B6673", fontFace: "Aptos", fontSize: 9 },
});
const C = { purple: "6543A3", deep: "30283C", ink: "292631", muted: "6D6876", lilac: "EEE8F6", paper: "F7F6FA", white: "FFFFFF", line: "DDD9E5", charcoal: "302D35", green: "356B59", amber: "9A6424", red: "9C514D" };
const W = 13.333, H = 7.5;
const font = "Aptos";
const titleFont = "Aptos Display";
const esc = (s) => String(s);
function addTitle(slide, kicker, title, sub = "") {
  slide.addText(kicker.toUpperCase(), { x: 0.7, y: 0.42, w: 11.9, h: 0.22, fontFace: font, fontSize: 10, bold: true, charSpacing: 1.7, color: C.purple, margin: 0 });
  slide.addText(title, { x: 0.68, y: 0.78, w: 12.0, h: 0.7, fontFace: titleFont, fontSize: 29, bold: true, color: C.ink, margin: 0, breakLine: false, fit: "shrink" });
  if (sub) slide.addText(sub, { x: 0.7, y: 1.49, w: 11.85, h: 0.44, fontFace: font, fontSize: 13, color: C.muted, margin: 0, breakLine: false, fit: "shrink" });
}
function addCard(slide, x, y, w, h, heading, body, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, line: { color: opts.line || C.line, width: 0.8 }, fill: { color: opts.fill || C.white }, radius: 0.08, shadow: opts.shadow ? { type: "outer", color: "191523", opacity: 0.09, blur: 2, angle: 45, distance: 1 } : undefined });
  if (opts.number) slide.addText(opts.number, { x: x + 0.2, y: y + 0.18, w: 0.42, h: 0.32, fontFace: titleFont, fontSize: 17, bold: true, color: C.purple, margin: 0 });
  const hx = x + (opts.number ? 0.68 : 0.22);
  slide.addText(heading, { x: hx, y: y + 0.18, w: w - (hx - x) - 0.16, h: opts.headingH || 0.38, fontFace: font, fontSize: opts.headingSize || 15, bold: true, color: C.ink, margin: 0, fit: "shrink" });
  slide.addText(body, { x: x + 0.22, y: y + (opts.bodyY || 0.68), w: w - 0.44, h: h - (opts.bodyY || 0.68) - 0.16, fontFace: font, fontSize: opts.bodySize || 12, color: opts.bodyColor || C.muted, margin: 0, breakLine: false, valign: "top", paraSpaceAfterPt: 6, bullet: false, fit: "shrink", lineSpacingMultiple: 1.08 });
}
function bullets(slide, items, x, y, w, h, size = 17, color = C.ink, gap = 0.56) {
  items.forEach((item, i) => {
    slide.addShape(pptx.ShapeType.ellipse, { x, y: y + i * gap + 0.11, w: 0.11, h: 0.11, line: { color: C.purple, transparency: 100 }, fill: { color: C.purple } });
    slide.addText(item, { x: x + 0.24, y: y + i * gap, w: w - 0.24, h: gap - 0.06, fontFace: font, fontSize: size, color, margin: 0, valign: "mid", fit: "shrink", breakLine: false });
  });
}
function footerTag(slide, text, y = 6.72) {
  slide.addText(text, { x: 0.7, y, w: 11.8, h: 0.19, fontFace: font, fontSize: 9, color: C.muted, italic: true, margin: 0, fit: "shrink" });
}
function notes(slide, text) { slide.addNotes(text); }
function addPhoto(slide, imagePath, x, y, w, h, label) {
  return sharp(imagePath).metadata().then(({ width, height }) => {
    const scale = Math.min(w / width, h / height);
    const dw = width * scale, dh = height * scale;
    slide.addImage({ path: imagePath, x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh });
    slide.addShape(pptx.ShapeType.rect, { x, y: y + h - 0.35, w, h: 0.35, line: { color: C.deep, transparency: 100 }, fill: { color: C.deep, transparency: 13 } });
    slide.addText(label, { x: x + 0.12, y: y + h - 0.28, w: w - 0.24, h: 0.16, fontFace: font, fontSize: 8, color: C.white, margin: 0, fit: "shrink" });
  });
}
function slide() { return pptx.addSlide("LIGHT"); }

// 1 — cover
{
  const s = pptx.addSlide();
  s.background = { color: C.deep };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, line: { color: C.purple, transparency: 100 }, fill: { color: C.purple } });
  s.addShape(pptx.ShapeType.ellipse, { x: 9.2, y: -1.5, w: 5.2, h: 5.2, line: { color: "7254A6", transparency: 100 }, fill: { color: "7254A6", transparency: 55 } });
  s.addShape(pptx.ShapeType.ellipse, { x: 10.1, y: 3.9, w: 3.9, h: 3.9, line: { color: "A994CB", transparency: 100 }, fill: { color: "A994CB", transparency: 65 } });
  s.addText("DIIC3110  /  ICT4D GROUP ASSIGNMENT", { x: 0.85, y: 0.75, w: 7.4, h: 0.28, fontFace: font, fontSize: 11, bold: true, charSpacing: 2, color: "D8C9EC", margin: 0 });
  s.addText("Salon Management\nSystem", { x: 0.82, y: 1.48, w: 8.3, h: 1.85, fontFace: titleFont, fontSize: 43, bold: true, color: C.white, margin: 0, breakLine: false, fit: "shrink", lineSpacingMultiple: 0.9 });
  s.addText("A practical digital workflow for independent beauty professionals and their customers", { x: 0.86, y: 3.65, w: 7.2, h: 0.72, fontFace: font, fontSize: 19, color: "E5E0EB", margin: 0, fit: "shrink" });
  s.addText("GROUP MEMBERS  ·  [ADD NAMES]\nCOMMUNITY PARTNER  ·  [CONFIRM NAME / CONSENT]", { x: 0.86, y: 5.68, w: 7.6, h: 0.62, fontFace: font, fontSize: 11, bold: true, color: "D8C9EC", margin: 0, breakLine: false, fit: "shrink" });
  s.addText("20-minute presentation  ·  5-minute Q&A", { x: 0.86, y: 6.65, w: 5.8, h: 0.28, fontFace: font, fontSize: 11, color: "C5BECE", margin: 0 });
  notes(s, "Opening: introduce the group and the system in one sentence. Replace the bracketed fields before presenting. Do not imply a community partner relationship or consent unless the group has confirmed it. Time: 0:40.");
}
// 2 — introduction
{
  const s = slide(); addTitle(s, "01 · Introduction", "A digital service, not just a booking page", "The project connects public service discovery with private, role-scoped salon operations.");
  addCard(s, 0.72, 2.15, 3.75, 2.72, "Discover", "Customers can browse a published professional profile and its actual published services.", { number: "01", shadow: true });
  addCard(s, 4.78, 2.15, 3.75, 2.72, "Coordinate", "Appointment requests reserve a time, create a reference, and open a manual WhatsApp conversation.", { number: "02", shadow: true });
  addCard(s, 8.84, 2.15, 3.75, 2.72, "Manage", "Professionals control their own appointments, policies, availability, customers, and records.", { number: "03", shadow: true });
  footerTag(s, "Scope: Lesotho context and Africa/Maseru scheduling. Community needs and impact claims require local evidence.");
  notes(s, "Describe the system based on current implementation. Avoid generalized claims about all salons; state that community-specific assumptions still require validation. Time: 1:00.");
}
// 3 — partner
{
  const s = slide(); addTitle(s, "02 · Community partner", "Partner identity must be confirmed by the group", "No partner name, agreement, quotation, or permission was present in the project materials reviewed.");
  s.addShape(pptx.ShapeType.roundRect, { x: 0.75, y: 2.15, w: 7.45, h: 3.85, rectRadius: 0.08, line: { color: "D7CBE5", width: 1 }, fill: { color: C.white } });
  s.addText("[COMMUNITY PARTNER / SALON NAME]", { x: 1.1, y: 2.62, w: 6.7, h: 0.55, fontFace: titleFont, fontSize: 23, bold: true, color: C.purple, margin: 0, fit: "shrink" });
  bullets(s, ["Location / community: [ADD VERIFIED DETAIL]", "Contact and permission: [CONFIRM BEFORE SHARING]", "Partner role in design/testing: [DOCUMENT WHAT OCCURRED]"], 1.12, 3.48, 6.55, 1.7, 14, C.ink, 0.52);
  addCard(s, 8.55, 2.15, 3.95, 3.85, "Evidence checkpoint", "Do not invent a partner, interview, endorsement, or pilot. If partnership is not formalized, say so plainly and describe the intended stakeholder group instead.", { fill: "F1EDF6", bodyY: 0.9, bodySize: 16 });
  notes(s, "Before presenting, replace the placeholder only with information the partner has approved for disclosure. If no partner agreement exists, explain the project as an academic prototype and identify the intended user group. Time: 0:50.");
}
// 4 — problem framing
{
  const s = slide(); addTitle(s, "03 · Problem statement", "A problem statement to validate—not assume", "The prototype addresses coordination questions that must be checked with local professionals and customers.");
  const q = ["How are appointment times requested and confirmed today?", "How are service prices, booking fees, and changes communicated?", "How are customer contact details and receipts kept private and accurate?", "What happens when connectivity is slow, shared, or unavailable?"];
  bullets(s, q, 1.0, 2.25, 7.2, 3.1, 16, C.ink, 0.78);
  addCard(s, 8.7, 2.3, 3.55, 3.25, "Evidence status", "No interview findings or baseline survey are included in this repository. Present these as discovery questions until the group adds verified evidence.", { fill: "FFF7E9", bodyY: 0.95, bodySize: 16, bodyColor: C.charcoal });
  notes(s, "Frame these as hypotheses and discovery prompts, not established community facts. Ask the audience what evidence would be needed. Time: 1:00.");
}
// 5 — needs assessment
{
  const s = slide(); addTitle(s, "04 · Needs assessment", "A light, ethical assessment plan", "Document evidence before turning product assumptions into requirements.");
  const rows = [
    ["Listen", "Short, voluntary interviews with professionals and customers", "Status: not evidenced here"],
    ["Observe", "Walk through a booking, reschedule, cancellation, and payment-verification scenario", "Status: not evidenced here"],
    ["Check access", "Test low-end mobile viewport, language preference, accessibility, and connectivity limits", "Browser responsive checks exist; no field study"],
    ["Validate", "Review findings with participants; record consent and approved quotations", "Add date, method, count, and consent record"],
  ];
  rows.forEach((r, i) => {
    const y = 2.05 + i * 1.05;
    s.addShape(pptx.ShapeType.roundRect, { x: 0.78, y, w: 11.78, h: 0.82, rectRadius: 0.04, line: { color: C.line, width: 0.6 }, fill: { color: i % 2 ? C.white : "F0EDF4" } });
    s.addText(r[0], { x: 1.0, y: y + 0.17, w: 1.35, h: 0.26, fontFace: font, fontSize: 14, bold: true, color: C.purple, margin: 0 });
    s.addText(r[1], { x: 2.35, y: y + 0.13, w: 6.2, h: 0.43, fontFace: font, fontSize: 13, color: C.ink, margin: 0, fit: "shrink", valign: "mid" });
    s.addText(r[2], { x: 8.75, y: y + 0.15, w: 3.48, h: 0.4, fontFace: font, fontSize: 10, bold: true, color: C.amber, margin: 0, fit: "shrink", valign: "mid" });
  });
  notes(s, "Explain which research is completed and which is planned. Repository evidence supports responsive browser checks only; it does not support interviews, usability feedback, or a needs-assessment sample. Time: 1:05.");
}
// 6 — objectives
{
  const s = slide(); addTitle(s, "05 · Objectives", "Build and verify a usable online workflow", "Objectives are implementation and evaluation commitments—not claimed social impact outcomes.");
  const obj = [
    ["01", "Publish", "Let each professional manage a public profile, services, prices, hours, and booking rules."],
    ["02", "Coordinate", "Support customer booking requests, clear references, appointment states, and manual WhatsApp follow-up."],
    ["03", "Protect", "Enforce three roles, tenant boundaries, private customer/payment data, and server-side validation."],
    ["04", "Evaluate", "Measure completion, responsiveness, accessibility, and connectivity behavior with agreed KPIs."],
  ];
  obj.forEach((r, i) => addCard(s, 0.78 + (i % 2) * 6.05, 2.05 + Math.floor(i / 2) * 1.95, 5.75, 1.62, r[1], r[2], { number: r[0], bodyY: 0.62, bodySize: 12 }));
  notes(s, "Read the objectives as testable product goals. Evaluation targets should be set with participants after a baseline, not filled with invented success percentages. Time: 0:55.");
}
// 7 — SDGs
{
  const s = slide(); addTitle(s, "06 · SDG alignment", "A plausible contribution pathway—no impact claim", "The system can enable better coordination; the SDGs do not certify outcomes.");
  addCard(s, 0.78, 2.12, 5.72, 3.62, "SDG 8 · Decent work & growth", "Target 8.3: support productive activities, entrepreneurship, creativity, innovation, and growth of micro/small enterprises.\n\nTarget 8.5: decent work and equal pay require wider economic and labour evidence beyond this software.", { number: "8", bodyY: 0.92, bodySize: 14 });
  addCard(s, 6.78, 2.12, 5.72, 3.62, "SDG 9 · Industry & innovation", "Target 9.3: improve small-enterprise access to financial services and markets. The app records externally verified payments; it does not provide credit or a payment service.\n\nDigital tools are an enabling layer, not proof of inclusion.", { number: "9", bodyY: 0.92, bodySize: 14 });
  footerTag(s, "Sources: UN SDG targets 8.3, 8.5, 9.3 — sdgs.un.org/goals/goal8 and /goal9");
  notes(s, "Be precise: the software supports enterprise organization and market visibility. It does not create employment, ensure decent work, supply finance, or prove SDG progress. Source: UN Sustainable Development Goals, Targets 8.3, 8.5, 9.3. Time: 1:10.");
}
// 8 — solution
{
  const s = slide(); addTitle(s, "07 · Proposed solution", "One workflow from discovery to verified confirmation", "Three clear boundaries: professional ownership, public versus private data, and manual payment verification.");
  const steps = [["01", "Browse", "Published profile & real service"], ["02", "Request", "Reserve an available time"], ["03", "Contact", "Customer opens professional WhatsApp"], ["04", "Verify", "Professional records and checks receipt"], ["05", "Confirm", "Booking changes only after verification"]];
  steps.forEach((r, i) => {
    const x = 0.72 + i * 2.48;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 2.55, w: 2.15, h: 2.0, rectRadius: 0.06, line: { color: i === 4 ? C.purple : C.line, width: i === 4 ? 1.4 : 0.8 }, fill: { color: i === 4 ? C.lilac : C.white } });
    s.addText(r[0], { x: x + 0.16, y: 2.75, w: 0.5, h: 0.26, fontFace: titleFont, fontSize: 16, bold: true, color: C.purple, margin: 0 });
    s.addText(r[1], { x: x + 0.16, y: 3.17, w: 1.85, h: 0.35, fontFace: font, fontSize: 15, bold: true, color: C.ink, margin: 0 });
    s.addText(r[2], { x: x + 0.16, y: 3.62, w: 1.82, h: 0.62, fontFace: font, fontSize: 11, color: C.muted, margin: 0, fit: "shrink" });
    if (i < steps.length - 1) s.addText("→", { x: x + 2.19, y: 3.3, w: 0.28, h: 0.34, fontFace: font, fontSize: 19, bold: true, color: C.purple, margin: 0, align: "center" });
  });
  s.addText("WhatsApp is a handoff for a person to send. No gateway, auto-send, or automatic paid status.", { x: 1.0, y: 5.28, w: 11.2, h: 0.42, fontFace: font, fontSize: 15, bold: true, color: C.deep, align: "center", margin: 0, fit: "shrink" });
  notes(s, "Walk the audience through the actual state changes. A request remains pending; WhatsApp opening is not proof of contact or payment. Only the owning professional verifies an actual external receipt. Time: 1:05.");
}
// 9 — architecture
{
  const s = slide(); addTitle(s, "08 · Architecture", "A familiar web stack with strict business boundaries", "Existing system: React / React Router / Tailwind / esbuild → Express / Zod → MongoDB transactions.");
  const nodes = [
    { x: 0.82, title: "CUSTOMER", body: "Public discovery\nOwn bookings & profile" },
    { x: 4.15, title: "PROFESSIONAL", body: "Own services, hours\nAppointments & finances" },
    { x: 7.48, title: "ADMIN", body: "Platform accounts\nShared platform settings" },
  ];
  nodes.forEach((n) => {
    s.addShape(pptx.ShapeType.roundRect, { x: n.x, y: 2.1, w: 2.78, h: 1.13, rectRadius: 0.06, line: { color: C.line, width: 1 }, fill: { color: C.white } });
    s.addText(n.title, { x: n.x + 0.15, y: 2.28, w: 2.45, h: 0.24, fontFace: font, fontSize: 11, bold: true, charSpacing: 1, color: C.purple, align: "center", margin: 0 });
    s.addText(n.body, { x: n.x + 0.12, y: 2.62, w: 2.52, h: 0.44, fontFace: font, fontSize: 10, color: C.ink, align: "center", margin: 0, fit: "shrink" });
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 2.1, y: 4.12, w: 8.95, h: 1.2, rectRadius: 0.06, line: { color: C.purple, width: 1.2 }, fill: { color: "EEE8F6" } });
  s.addText("SERVER-AUTHORISED API", { x: 2.3, y: 4.34, w: 8.55, h: 0.28, fontFace: font, fontSize: 14, bold: true, color: C.deep, align: "center", margin: 0 });
  s.addText("Zod validation · JWT/bcrypt sessions · ownership-scoped queries · transaction-safe slots and payment states", { x: 2.35, y: 4.73, w: 8.45, h: 0.3, fontFace: font, fontSize: 10, color: C.muted, align: "center", margin: 0, fit: "shrink" });
  [[2.2, 3.23, 3.2, 4.05], [5.55, 3.23, 6.45, 4.05], [8.9, 3.23, 9.8, 4.05]].forEach((a) => s.addShape(pptx.ShapeType.line, { x: a[0], y: a[1], w: a[2] - a[0], h: a[3] - a[1], line: { color: "9C8BB3", width: 1.4, beginArrowType: "none", endArrowType: "triangle" } }));
  s.addShape(pptx.ShapeType.roundRect, { x: 3.18, y: 5.82, w: 6.8, h: 0.56, rectRadius: 0.04, line: { color: C.line, width: 0.7 }, fill: { color: C.white } });
  s.addText("MongoDB / Mongoose · private professional records · UTC storage · Africa/Maseru display", { x: 3.34, y: 5.98, w: 6.45, h: 0.18, fontFace: font, fontSize: 10, color: C.ink, align: "center", margin: 0, fit: "shrink" });
  s.addText("Admin has no private financial override", { x: 4.2, y: 6.55, w: 5.0, h: 0.2, fontFace: font, fontSize: 10, bold: true, color: C.red, align: "center", margin: 0 });
  notes(s, "Explain that the diagram represents the current repository architecture. Production deployment, database connection, SMTP, Google OAuth, and durable object-storage readiness remain separate configuration tasks. Time: 1:05.");
}
// 10 — roles
{
  const s = slide(); addTitle(s, "09 · Role boundaries", "Three roles, least privilege by design", "Published information is visible; bookkeeping and customer records stay within the permitted relationship.");
  addCard(s, 0.78, 2.12, 3.72, 3.75, "Admin", "Creates professional accounts and manages shared platform accounts/settings.\n\nCannot access private bookings, verify money, or read professional financial reports.", { number: "A", bodyY: 0.91, bodySize: 14 });
  addCard(s, 4.8, 2.12, 3.72, 3.75, "Professional", "Owns one independent business profile, services, availability, appointments, customers, manual receipts, expenses, and reports.\n\nVerifies only their own actual received funds.", { number: "P", bodyY: 0.91, bodySize: 14 });
  addCard(s, 8.82, 2.12, 3.72, 3.75, "Customer", "Self-registers as a customer; sees published profiles/services and manages only their own account, bookings, payments, and notifications.", { number: "C", bodyY: 0.91, bodySize: 14 });
  notes(s, "Emphasize that the admin is not a salon-owner superuser. Professional ownership is derived from the session on the server. Time: 1:00.");
}
// 11 — features
{
  const s = slide(); addTitle(s, "10 · Main features", "Useful daily tools, not decorative metrics", "Features shown in the existing application; real professionals supply their own business content.");
  const items = [
    ["Business profile", "Owner-managed public details; unpublished until ready."],
    ["Services & prices", "Owner-added listings, durations, integer lisente prices and optional photos."],
    ["Availability", "Professional hours, closure dates and quarter-hour slots."],
    ["Appointment list", "Search, dates, status tabs, references and responsive details."],
    ["Manual bookkeeping", "Awaiting verification versus independently verified receipts."],
    ["Notifications & audit", "Role-scoped events; business/platform trails separated."],
  ];
  items.forEach((r, i) => addCard(s, 0.78 + (i % 3) * 4.05, 2.0 + Math.floor(i / 3) * 2.1, 3.72, 1.78, r[0], r[1], { number: String(i + 1).padStart(2, "0"), bodyY: 0.68, bodySize: 11 }));
  notes(s, "Keep the distinction between implemented product functionality and professional onboarding content. No real service names, prices, reviews, or affiliations are prefilled for the four invitees. Time: 1:00.");
}
// 12 — booking & payments
{
  const s = slide(); addTitle(s, "11 · WhatsApp & manual payment", "A human stays in control of every money decision", "WhatsApp is click-to-chat. It never sends automatically and never marks a payment paid.");
  const steps = [
    ["Request", "Pending appointment + unique reference"],
    ["Arrange", "Customer contacts selected professional via WhatsApp"],
    ["Record", "Professional records actual external receipt"],
    ["Verify", "Owner checks the funds and confirms manually"],
  ];
  steps.forEach((r, i) => {
    const y = 2.04 + i * 0.93;
    s.addShape(pptx.ShapeType.ellipse, { x: 0.93, y: y + 0.03, w: 0.42, h: 0.42, line: { color: C.purple, transparency: 100 }, fill: { color: C.purple } });
    s.addText(String(i + 1), { x: 0.93, y: y + 0.11, w: 0.42, h: 0.18, fontFace: font, fontSize: 11, bold: true, color: C.white, align: "center", margin: 0 });
    s.addText(r[0], { x: 1.62, y, w: 1.3, h: 0.3, fontFace: font, fontSize: 15, bold: true, color: C.ink, margin: 0 });
    s.addText(r[1], { x: 3.02, y, w: 5.9, h: 0.38, fontFace: font, fontSize: 13, color: C.muted, margin: 0, fit: "shrink" });
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 9.5, y: 2.22, w: 2.8, h: 3.25, rectRadius: 0.06, line: { color: "E3CBA8", width: 1 }, fill: { color: "FFF7E9" } });
  s.addText("STATE RULE", { x: 9.75, y: 2.52, w: 2.3, h: 0.25, fontFace: font, fontSize: 10, bold: true, charSpacing: 1.2, color: C.amber, margin: 0 });
  s.addText("Opening a chat\n≠ message sent\n≠ payment received\n≠ appointment confirmed", { x: 9.75, y: 3.0, w: 2.3, h: 1.75, fontFace: titleFont, fontSize: 18, bold: true, color: C.deep, margin: 0, fit: "shrink", breakLine: false });
  s.addText("Only manual verification changes the payment state.", { x: 1.0, y: 6.2, w: 11.2, h: 0.28, fontFace: font, fontSize: 14, bold: true, color: C.purple, align: "center", margin: 0 });
  notes(s, "Demonstrate the safe sequence: awaiting verification is not a receipt; a receipt is not paid until the owning professional independently verifies actual funds. WhatsApp is a manual handoff only. Time: 1:15.");
}
// 13 — screenshots
{
  const s = slide(); addTitle(s, "12 · System screens", "Built screens from the running synthetic demonstration", "Real application screenshots; sample names and booking records are synthetic—not community transactions.");
  const a = path.join(root, ".local/dashboard-review/professional-upcoming-desktop.png");
  const b = path.join(root, ".local/dashboard-review/customer-mobile.png");
  await Promise.all([
    addPhoto(s, a, 0.9, 2.07, 7.25, 4.05, "PROFESSIONAL DASHBOARD · SYNTHETIC DEMO RECORDS"),
    addPhoto(s, b, 9.15, 2.06, 1.84, 4.1, "CUSTOMER VIEW · SYNTHETIC DATA"),
  ]);
  s.addText("Current interface evidence only. Replace/augment with the live presentation environment after verifying data and connectivity.", { x: 1.0, y: 6.43, w: 11.1, h: 0.25, fontFace: font, fontSize: 9, color: C.muted, italic: true, align: "center", margin: 0, fit: "shrink" });
  notes(s, "These are genuine project screenshots from the previous local synthetic demo. Explicitly label the sample data; do not describe it as a customer pilot. Time: 1:00.");
}
// 14 — participation
{
  const s = slide(); addTitle(s, "13 · Community participation", "Participation must be reported honestly", "No participant testing, interview feedback, or consent records were supplied with this checkout.");
  addCard(s, 0.78, 2.16, 5.72, 3.55, "What is verified", "Automated local checks cover role navigation, responsive layouts, booking flow, manual payment verification, and service-image upload.\n\nThese are developer tests, not community participation.", { fill: C.white, bodyY: 0.9, bodySize: 14 });
  addCard(s, 6.78, 2.16, 5.72, 3.55, "What the group must add", "Participant roles (not names without consent) · date/method · tasks observed · approved feedback · issues changed in response · consent/privacy process.", { fill: "FFF7E9", bodyY: 0.9, bodySize: 15 });
  footerTag(s, "If no community test occurred, state that it is planned—not completed.");
  notes(s, "Disclose limitations. Do not use team members or automated tests as proxies for community participation. Add real evidence only after consent and documentation. Time: 0:55.");
}
// 15 — KPIs
{
  const s = slide(); addTitle(s, "14 · Monitoring & evaluation", "Five proposed indicators—with no fabricated baseline", "Agree the target and collection cadence with stakeholders before claiming success.");
  const kpis = [
    ["Request completion", "Started requests that become saved appointments ÷ all started requests"],
    ["Time to response", "Median time from request notification to first human response"],
    ["Record completeness", "Confirmed bookings with required reference, snapshot, and verified receipt fields"],
    ["Service readiness", "Invited professionals completing profile + WhatsApp + ≥1 real service before publication"],
    ["Offline resilience", "Successful shell recovery and public-cache access in scripted offline checks"],
  ];
  kpis.forEach((r, i) => {
    const y = 2.0 + i * 0.83;
    s.addText(String(i + 1).padStart(2, "0"), { x: 0.9, y: y + 0.04, w: 0.45, h: 0.22, fontFace: font, fontSize: 11, bold: true, color: C.purple, margin: 0 });
    s.addText(r[0], { x: 1.5, y, w: 2.7, h: 0.3, fontFace: font, fontSize: 13, bold: true, color: C.ink, margin: 0, fit: "shrink" });
    s.addText(r[1], { x: 4.15, y, w: 6.2, h: 0.34, fontFace: font, fontSize: 11, color: C.muted, margin: 0, fit: "shrink" });
    s.addText("BASELINE: TBD", { x: 10.68, y, w: 1.55, h: 0.28, fontFace: font, fontSize: 9, bold: true, color: C.amber, align: "right", margin: 0 });
    s.addShape(pptx.ShapeType.line, { x: 1.5, y: y + 0.55, w: 10.73, h: 0, line: { color: C.line, width: 0.55 } });
  });
  notes(s, "These are proposed KPI definitions, not measured results. State that baselines, targets, sample, and data-collection schedule still need agreement. Avoid collecting extra personal data to calculate metrics. Time: 1:05.");
}
// 16 — ethics and privacy
{
  const s = slide(); addTitle(s, "15 · Privacy & ethics", "Trust is part of the product", "Design and presentation choices that reduce avoidable harm.");
  const ethics = [
    ["Data minimization", "Only collect booking details needed for coordination; no broad shared customer directory."],
    ["Tenant isolation", "Professionals see only their own business records; admin has no private-finance override."],
    ["Consent & clarity", "Explain contact use, policy/fee snapshots, status, and that WhatsApp does not send automatically."],
    ["Shared-device safety", "Never cache tokens, private bookings, financial records, or queued money actions offline."],
    ["Honest evidence", "Synthetic demo data is labeled; no invented partner, review, price, or impact claim."],
  ];
  ethics.forEach((r, i) => addCard(s, 0.8 + (i % 2) * 6.02, 2.0 + Math.floor(i / 2) * 1.34, 5.7, 1.05, r[0], r[1], { bodyY: 0.48, headingSize: 13, bodySize: 10 }));
  notes(s, "Mention privacy implications of customer names, phone numbers, appointment histories, and financial records. The browser never caches private API responses. Real privacy notices and participant consent still need review. Time: 1:00.");
}
// 17 — sustainability + offline
{
  const s = slide(); addTitle(s, "16 · Sustainability & offline roadmap", "Useful offline shell now; synchronized work later", "Phase one improves shell resilience without creating unsafe promises about offline bookings.");
  addCard(s, 0.8, 2.12, 3.72, 3.55, "NOW · Phase one", "Installable app shell\nOffline fallback\nCached static files\nAllowlisted public profiles, services and images\nOnline/offline status\nServer-only booking/payment actions", { fill: C.white, bodyY: 0.92, bodySize: 13 });
  addCard(s, 4.8, 2.12, 3.72, 3.55, "NEXT · Governed design", "Participant consent & shared-device threat model\nPer-user encrypted local data only if justified\nOffline expiry and revocation policy\nConflict/slot reservation semantics", { fill: C.lilac, bodyY: 0.92, bodySize: 14 });
  addCard(s, 8.8, 2.12, 3.72, 3.55, "LATER · Tested sync", "Foreground reconnect sync\nServer authorization on every write\nConflict resolution and audit trail\nNo automatic payment verification\nField-test on low-cost phones/networks", { fill: "FFF7E9", bodyY: 0.92, bodySize: 14 });
  notes(s, "Phase one caches only the shell and public catalog. Do not imply offline appointment reservations, payment confirmation, or reliable queued synchronization. Sustainability also depends on owner onboarding, support, connectivity costs, and maintenance. Time: 1:00.");
}
// 18 — close/demo
{
  const s = pptx.addSlide(); s.background = { color: C.deep };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: H, line: { color: C.purple, transparency: 100 }, fill: { color: C.purple } });
  s.addText("17 · CONCLUSION & LIVE DEMONSTRATION", { x: 0.82, y: 0.56, w: 10.8, h: 0.24, fontFace: font, fontSize: 10, bold: true, charSpacing: 1.6, color: "D8C9EC", margin: 0 });
  s.addText("Make the next\nappointment clearer.", { x: 0.82, y: 1.15, w: 7.6, h: 1.55, fontFace: titleFont, fontSize: 37, bold: true, color: C.white, margin: 0, fit: "shrink" });
  s.addText("A focused platform for discovery, professional control, and transparent manual confirmation.", { x: 0.86, y: 3.02, w: 7.2, h: 0.65, fontFace: font, fontSize: 17, color: "E5E0EB", margin: 0, fit: "shrink" });
  s.addText("DEMO: public services → customer request → professional appointment list → manual fee record → human verification", { x: 0.86, y: 4.32, w: 10.4, h: 0.55, fontFace: font, fontSize: 13, bold: true, color: "D8C9EC", margin: 0, fit: "shrink" });
  s.addText("Questions & discussion  ·  5 minutes", { x: 0.86, y: 5.58, w: 5.8, h: 0.35, fontFace: font, fontSize: 16, bold: true, color: C.white, margin: 0 });
  s.addText("Group: [ADD NAMES]  ·  Contact: [OPTIONAL, CONSENTED]", { x: 0.86, y: 6.62, w: 8, h: 0.22, fontFace: font, fontSize: 9, color: "C5BECE", margin: 0 });
  notes(s, "Close with the prototype's boundaries, then start the safe synthetic demo. Do not use real accounts, real customer records, real payments, or credentials on screen. Invite questions. Time: 0:40 plus up to 5:00 Q&A.");
}

await fs.mkdir(path.dirname(out), { recursive: true });
await pptx.writeFile({ fileName: out, compression: true });
console.log(`Created editable 18-slide presentation: ${path.relative(root, out)}`);
