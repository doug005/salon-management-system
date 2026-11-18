# Presentation Script — Salon Management System

**Course:** DIIC3110 ICT4D group assignment
**Duration:** 20 minutes including the short demonstration; 5 minutes Q&A
**Status:** Draft aligned to the requested outline. The official `2026 Group Assignment.pdf` was not present in the workspace or project area checked. Reconcile this draft against the official brief before presenting.

## Before presentation

Replace group-member and community-partner placeholders only with confirmed information. No interview findings, partner endorsement, participant count, pilot results, or impact measurements were supplied. The UI screenshots show synthetic demonstration records; label them as such. Set KPI targets only after the group agrees on a baseline and method.

## Slide-by-slide speaking notes

### 1. Title — 0:40
“Good morning. We are presenting the Salon Management System, an ICT4D group project for clearer service discovery, appointment coordination, and professional-owned business management. Our group members are [names]. Our confirmed community partner is [name], or, if not confirmed, we are presenting an academic prototype for independent beauty professionals.”

### 2. Introduction — 1:00
“The system links a public service catalogue to private workspaces. Customers can discover published services and request appointments. A professional controls their own profile, services, hours, appointments, and business records. We are presenting the implemented workflow, not claiming proven community-wide outcomes.”

### 3. Community partner — 0:50
“[State the partner’s confirmed identity, location, and agreed role.] We include only details the partner permitted us to share. If no formal partner or consent exists, say that directly and describe independent salon professionals as the intended stakeholder group rather than inventing a partner.”

### 4. Problem framing — 1:00
“Our problem statement is framed as questions to validate: how are bookings coordinated, how are prices and changes communicated, how are customer details and receipts protected, and what happens under unreliable connectivity? We do not have a verified baseline in this project folder, so we are not presenting assumptions as findings.”

### 5. Needs assessment — 1:05
“A responsible needs assessment would combine voluntary interviews, a workflow walkthrough, low-cost mobile and connectivity checks, and participant review of findings. The repository contains automated developer tests, not evidence of participant testing. [If the group has actual evidence, give the method, date, and consent status here.]”

### 6. Objectives — 0:55
“Our objectives are to enable professionals to publish real business information, support booking coordination, enforce role and business-data boundaries, and evaluate usability and reliability with agreed indicators. These are product objectives; they are not claims of increased income or employment.”

### 7. SDG alignment — 1:10
“Target 8.3 is relevant to productive activity and the growth of micro and small enterprises. Target 8.5 concerns decent work and equal pay, which this software alone cannot ensure. Target 9.3 concerns small enterprises’ access to finance and markets; our public catalogue may help visibility, but we do not provide credit or process payments. Alignment describes a possible contribution pathway, not measured progress.”

### 8. Proposed solution — 1:05
“The flow begins with a published profile and actual service. A customer requests an available time and receives a reference. The customer may open a WhatsApp chat to arrange external payment. The professional records a received receipt and independently verifies it. Only then can the booking become confirmed.”

### 9. Architecture — 1:05
“The existing frontend uses React, React Router, Tailwind, and esbuild. The Express backend validates inputs with Zod, applies session and role checks, and scopes queries by professional. MongoDB transactions and unique slot claims protect concurrent bookings. UTC is stored and Africa/Maseru is used for scheduling and display. Production service configuration is separate from the local synthetic demonstration.”

### 10. User roles — 1:00
“Admin manages platform accounts and shared settings, but cannot inspect private business finances or verify professional payments. Each professional manages only their own salon records. Customers manage only their own private account and bookings, while viewing explicitly published information.”

### 11. Main features — 1:00
“The current system includes profiles, services and prices entered by professionals, weekly availability, appointment search and status tabs, professional-scoped customers, notifications, and manually verified bookkeeping. A professional must supply their own business name, WhatsApp number, services, prices, and photos before presenting them publicly.”

### 12. WhatsApp and payment — 1:15
“WhatsApp is a manually sent message, not an automated integration. The customer-to-professional link uses the selected professional. The professional-to-customer link uses the customer number saved with that appointment. Opening a chat proves neither a message was sent nor payment was received. The server changes payment state only after the owning professional verifies an actual external receipt.”

### 13. System screens — 1:00
“These are screenshots of the project’s local synthetic demonstration. Names, services, and bookings shown are test data, not partner transactions. The screens show the existing role dashboard and customer mobile view. We will not expose passwords or real customer details during the live demonstration.”

### 14. Participation and testing — 0:55
“Automated browser and backend tests verify important flows, tenant isolation, manual verification, and responsive layouts. They are developer checks, not community participation. [Add only the group’s actual participant method, date, tasks, feedback, and consent-approved response here.] If no participant session happened, say it is planned.”

### 15. Monitoring and evaluation — 1:05
“We propose five indicators: the share of started requests saved successfully; median time to a human response; completeness of verified booking records; professional profile readiness; and successful offline-shell recovery. Baselines and targets are marked TBD. We will not invent figures or claim results before collecting them.”

### 16. Privacy and ethics — 1:00
“Customer contact and appointment information is private. Each professional sees only their own business records. Admin is not a universal business administrator. The application does not cache authentication tokens, private bookings, or financial data. We must also explain contact use, obtain appropriate consent, and label synthetic demonstrations.”

### 17. Sustainability and offline — 1:00
“Phase one is an installable app shell, cached static files, an offline fallback, a status indicator, and allowlisted public information. Booking, payment verification, and other writes still require the server. Full offline synchronization is a later design requiring consent, shared-device protection, expiry and revocation rules, server reauthorization, conflict handling, audit trails, and field tests.”

### 18. Conclusion and demo — 1:40
“To conclude, the prototype focuses on clear roles, professional control, and honest payment status. In the demo we will show published synthetic services, a customer request, the professional appointment list, and a manual receipt verification. No real payment or message will be sent. Thank you; we welcome your questions.”

## Q&A — 5 minutes

Suggested questions to prepare for:

- How does the system prevent two customers booking the same professional/time?
- What data can an administrator see?
- Does opening WhatsApp confirm a booking or payment?
- What still works without connectivity?
- What evidence would be required to evaluate impact with a community partner?
- How will real professionals safely receive their first access invitation?
