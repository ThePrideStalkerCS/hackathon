# Challenge Brief: Digital Assistants, Evolution to 2030 (Public Sector)

> Text version of `challenge-brief.pdf` (v0.3, Federal Chancellery / Bundeskanzleramt), so coding agents
> can read it reliably. The PDF next to this file is the original. If they differ, the PDF wins.

## 1. Challenge summary

**Challenge:** Digital Assistants: Evolution to 2030 (Public Sector)

The challenge outlines a forward-looking vision for citizen-government interactions. Participants are
challenged to demonstrate how a next-generation digital assistant can reliably process unstructured or
colloquial citizen inputs, translate complex administrative language into plain, easily accessible
information, and seamlessly guide citizens through public service workflows.

## 2. Goal

Concept and live prototype (PoC) of a Digital Public Service Assistant in 2030.

**Objective:** development of a fully functional live demo showcasing the future of public sector interactions.

**Key focus areas:**
- **Overall strategy and customer journey:** end-to-end process design tailored for citizens.
- **Design and communication:** intuitive, clear and accessible interfaces.
- **Technical architecture:** a scalable and secure system foundation.

**Inclusion and accessibility commitment:** full accessibility for all demographic groups, seamlessly
usable regardless of age, gender, digital literacy or personal circumstances.

## 3. Team requirements

- Each team must include at least one developer (with focus/knowledge in artificial intelligence) and one UX/UI designer.
- Knowledge in artificial intelligence as well as user experience design.

## 4. What the Federal Chancellery provides

- Live demo (current solution and storyline: AI chatbot "ida")
- Information regarding the target audience (citizens, public officials, etc.)
- Mentoring

Tech stack available to all teams (sponsorships organised by the hackathon host):
- Complete tech stack from Cloudflare for all teams on enterprise level for one week
- 10K credits from Amazon Web Services

## 5. Participant responsibilities

Each team must:
- **Build a prototype:** develop a functional live demo (or high-fidelity mockup).
- **Design an end-to-end customer journey:** map and handle the complete user experience, with a clear focus on defined personas.
- **Ensure high usability:** maintain a user-centric design that keeps the experience as intuitive and accessible as possible.
- **Operate within resource constraints:** stay within the provided environment and budget.

## 6. Expected behaviour

The system should be able to handle scenarios such as the ones on
https://www.oesterreich.gv.at/en/formsearch and https://www.oesterreich.gv.at/en/landingpages

- **User / input:** simulate a typical government interaction (e.g. passport renewal, address change, or permit application).
- **System:** the solution should support you within government services in an agent-based way.

The system must support:
- German and English, focus on accessibility (all segments of the population)
- Fallback scenarios for digital immigrants (human contact point if desired)

## 7. Suggested technical directions (optional)

- **Models and AI frameworks:** open-source / open-weight LLMs, commercial APIs, or fine-tuned domain-specific models.
- **Open data and APIs:** public registers, government open data portals, spatial data (e.g. OpenStreetMap), or synthetic citizen datasets.
- **Inclusive design and accessibility:** assistive tools (screen reader optimisations, plain-language generators, multi-language support).

## 8. Deliverables

- **High-level strategic concept:** vision, target personas and value proposition.
- **Working prototype or high-fidelity mockup:** a functional demonstration focused on 1–2 concrete use cases (e.g. automated forms, identity/passport updates, or public service guidance). Inspiration: oesterreich.gv.at Form Search and Topics & Services.
- **Short technical documentation:**
  - Architecture and approach (system setup and key technical decisions)
  - Data and API integration
  - Error handling and guardrails (uncertainty, unexpected input, edge cases)
  - Limitations and edge cases
  - Setup and deployment
- **Supporting artifacts and proof of work:** code repository, short demo video (1–2 minutes) or interactive walkthrough, system logs and test results.

## 9. Evaluation

- **Pre-announced test cases:** standard municipal workflows (renewing a passport, changing a primary residence, inquiring about childcare subsidies).
- **Unannounced test cases:** complex or combined requests to assess how the model generalises across administrative scenarios.
- **Realistic difficulties:** noisy or ambiguous input, colloquial language, incomplete citizen data, edge cases (e.g. non-standard residency status).
- **Core tasks:** accurately identifying intent, guiding citizens through multi-step forms, verifying prerequisites, generating structured administrative output.

The jury assesses whether the solution can understand the input, resolve the right result, use the API/data, and deliver a useful outcome.

| Criterion | Weight | What the jury looks for |
|---|---|---|
| End-to-end customer journey and UX | 35 % | Intuitive, seamless flow from initial query to completed request; full accessibility and inclusivity for all citizen demographics (age, language, digital literacy). |
| Innovation, conversational design and accessibility | 25 % | Novel interaction patterns (e.g. voice/multimodal inputs, plain-language translation, proactive assistance) that make government services effortless, intuitive and accessible. |
| Core accuracy and solution quality | 20 % | Correctly resolves requests, interprets complex intent, gives factually correct legal/administrative guidance, high-value outcomes without hallucinating. |
| Handling uncertainty and guardrails | 10 % | Detects missing information or ambiguity, asks clarifying questions, transparent confidence levels, no unauthorised administrative actions. |
| Robustness, inclusivity and polish | 10 % | Stable under edge cases and noisy input; polished UI/UX with smooth fallbacks during API latency or system errors. |

## 10. Constraints

- **Simulated environment:** access to real government databases or live backends is not required. Mock data, synthetic citizen profiles or simulated APIs are fine.
- **Public sector impact (Vision 2030):** the PoC must show how a 2030 assistant bridges the needs of citizens and public administration, streamlining procedures and reducing bureaucratic workload.
- **Strategic foundation:** teams submit a high-level strategy paper (vision, target personas, conceptual framework).
- **Focus on innovation:** the PoC should explicitly highlight innovative interaction patterns and novel approaches that radically simplify administrative workflows.

## 11. Success definition

A successful project demonstrates that an inclusive digital assistant can give the public reliable,
understandable information (in plain language) based on unstructured or conversational input, and use
these results to make interactions with the public sector seamless. The solution should visualise future
interactions between the public and the state and demonstrate new ways to reduce the administrative burden.
