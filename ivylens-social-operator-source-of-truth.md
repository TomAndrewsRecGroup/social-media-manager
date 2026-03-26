# IvyLens Social Media Operator & Business Task Agent
## Source of Truth Specification
### Version 1.0
### Owner: Tom Andrews
### Brand: IvyLens
### Status: Master specification for build and implementation

---

## 1. Purpose of This Document

This document is the single source of truth for the design, build, behaviour, boundaries, and implementation goals of the IvyLens Social Media Operator and Business Task Agent.

This document exists so that any coding agent, including Cline, can read it, understand the full product vision, and build toward a clearly defined end state without making assumptions, inventing features, drifting away from the brief, or creating unnecessary architecture.

This document should be treated as the controlling brief unless a newer version explicitly replaces it.

Where there is ambiguity, the spirit of the product should be interpreted as:

- commercially useful
- practical
- modular
- scalable
- automation-first
- operator-grade rather than demo-grade
- suitable for real-world business use
- designed to reduce Tom's manual workload
- capable of both scheduled and ad hoc task execution
- built to become a serious IvyLens product over time

---

## 2. Product Summary

The tool to be built is an IvyLens-branded cloud-based automation system that has two primary operating modes:

1. **Scheduled autonomous execution**
2. **Ad hoc conversational execution via Telegram**

At launch, the primary production task is **fully automated social media research, content generation, formatting, scheduling, and publishing** across multiple social platforms for Tom's business activities.

The system must also be built with the architectural ability to expand into a broader business operator that can receive commands over Telegram and then carry out practical business tasks on demand.

This is effectively a **JARVIS-like business assistant**, but built in a disciplined, modular, real-world way.

Not a toy chatbot.
Not a vague AI wrapper.
Not a one-purpose script.
Not a giant monolithic "AI agent" with no structure.

It must be a serious operational tool.

---

## 3. Product Objectives

## 3.1 Primary Objective

Automate social media management in a way that materially increases visibility, consistency, reach, brand recognition, and follower growth across Tom's channels.

## 3.2 Secondary Objective

Create a conversational business task layer that allows Tom to message the system via Telegram and instruct it to perform defined business actions.

## 3.3 Tertiary Objective

Lay the foundation for a wider IvyLens automation ecosystem that could later include:

- outreach automation
- inbox triage
- candidate or client workflow tasks
- ATS-related actions
- research support
- reporting
- reminders
- internal operational support
- brand publishing workflows
- multi-business support

---

## 4. Success Criteria

The system will be considered successful when it can reliably do the following:

### Social automation success criteria
- Research current trending or high-performing social content themes relevant to UK recruitment and Tom's sectors
- Identify the best content angles worth using
- Generate original posts inspired by trends, but not copied
- Create platform-specific variants for:
  - LinkedIn
  - Facebook
  - Instagram
  - X
- Publish them automatically at configured times
- Maintain message consistency while adapting structure and tone per platform
- Produce content that sounds commercially credible and relevant
- Send status summaries to Tom via Telegram
- Run without manual intervention once configured

### Conversational control success criteria
- Receive Telegram messages from Tom
- Interpret the request correctly
- Route the request to the correct internal function or agent
- Execute the requested task where supported
- Return a clear confirmation, result, or error message
- Keep logs of what it did

### Engineering success criteria
- Built cleanly enough that future features can be added without tearing it apart
- Hosted in Vercel
- Config-driven where practical
- Secure enough for real business usage
- Observable and debuggable
- Easy to extend

---

## 5. Core Product Scope

## 5.1 In Scope for Initial Build

### A. Social media research and publishing engine
This is the main production capability for version 1.

### B. Telegram conversational interface
Telegram is the first chat/control interface.

### C. Command router
The system must interpret standard command messages and decide which internal module or agent should execute the task.

### D. Scheduled task execution
The system must run predefined jobs on a schedule without Tom needing to trigger them manually.

### E. Vercel deployment
The system must be deployable and runnable in Vercel.

### F. Logging and execution history
The system must record actions, results, failures, and posting activity.

### G. Configurable tone and brand settings
The system must be able to generate content in Tom's tone and for Tom's businesses.

---

## 5.2 Out of Scope for Initial Build, But Must Be Architecturally Supported

These do not all need to be fully implemented in v1, but the architecture must not block them:

- Outlook or Microsoft 365 task automation
- Gmail or inbox workflows
- ATS/CRM integrations
- browser-based task automation for admin workflows
- approval workflows with buttons or slash commands
- analytics dashboards
- multi-user access
- multi-brand account switching
- memory or long-term task learning
- advanced performance optimisation loops
- client-facing SaaS packaging
- white-labelling
- Google Business Profile publishing unless confirmed supported
- WhatsApp interface
- voice interface
- document generation
- file handling workflows
- calendar tasks
- CRM-triggered automations

---

## 6. User and Ownership Context

### Primary user
Tom Andrews

### Role
CEO / Founder / Operator

### Usage profile
Tom wants a practical business assistant that saves time, removes repetitive manual work, and improves consistency of execution.

Tom is not looking for a novelty chatbot. He wants the system to behave like an operational member of the team.

### Communication preferences
The system should understand and support:
- direct communication
- concise but capable replies
- commercial business context
- UK recruitment context
- Tom's tone and communication style when generating output intended to represent him

---

## 7. Brand and Product Identity

### Product brand
IvyLens

### Product positioning
An intelligent business operator and automation system.

### Initial market-facing framing
Internally this may be referred to as a JARVIS-like assistant, but implementation should remain grounded and modular.

### Design philosophy
- serious
- capable
- efficient
- premium
- not gimmicky
- cloud-based
- automation-led
- extensible

---

## 8. Tech Stack

The requested and approved initial stack is:

- **OpenClaw** for orchestration and tool execution
- **Groq API** for LLM generation and reasoning tasks
- **Tavily** for live research, discovery, extraction, and source gathering
- **PostFast** for social media publishing
- **Telegram Bot API** for chat-based user interface
- **Vercel** for hosting, deployment, serverless functions, and scheduled tasks
- **GitHub** for version control and deployment workflow
- **VS Code + Cline** for implementation assistance

### Important implementation principle
Cline is a builder, not the runtime.
OpenClaw is the runtime/orchestrator.
Vercel is the hosted execution environment.

---

## 9. High-Level System Architecture

The system should follow a modular architecture rather than a single all-purpose AI blob.

Recommended conceptual structure:

```text
Telegram
  -> Webhook Handler
  -> Command Router
  -> Specialist Agents / Services
      -> Social Research
      -> Content Generation
      -> Publishing
      -> Business Task Execution
  -> External APIs
      -> Tavily
      -> Groq
      -> PostFast
      -> Future tools
```

For scheduled tasks:

```text
Vercel Cron
  -> Scheduled Trigger Endpoint
  -> OpenClaw Workflow
  -> Social Research
  -> Topic Selection
  -> Content Generation
  -> Platform Formatting
  -> Publishing
  -> Logging
  -> Telegram Summary
```

### Architectural rule
No monolithic mega-agent.
Use a router plus specialist modules.

---

## 10. Core Modules Required

## 10.1 Telegram Interface Module

### Purpose
Allow Tom to interact with the system conversationally via Telegram.

### Responsibilities
- receive Telegram messages via webhook
- validate that messages are from an authorised user
- extract message text and metadata
- pass the instruction to the command router
- return response messages to Telegram

### Requirements
- webhook-based, not polling
- secure verification
- support plain text commands initially
- designed for later support of buttons, approvals, and structured commands

### Example commands
- "Run today's social post cycle"
- "Give me 5 post ideas for LinkedIn about recruitment in aggregates"
- "Draft a post about salary inflation in engineering hiring"
- "Reply to the email from X saying Y in my tone"
- "Show me what posted today"
- "Pause auto-posting"
- "Restart scheduled tasks"

---

## 10.2 Command Router Module

### Purpose
Interpret incoming requests and route them to the correct module or workflow.

### Responsibilities
- classify intent
- identify required tools
- validate whether the requested action is supported
- call the correct internal service or agent
- return a structured result

### Supported command categories at minimum
- social content request
- social publishing request
- social reporting request
- schedule control request
- system status request
- business task request
- unsupported request response

### Router design principles
- deterministic where possible
- LLM-assisted only where useful
- avoid excessive free-form reasoning if the task can be handled with simple intent matching
- produce logs explaining route decisions

---

## 10.3 Social Research Module

### Purpose
Research trending, high-performing, current, and relevant content themes for social media content creation.

### Responsibilities
- gather live external information using Tavily
- search for UK recruitment-related trends
- search within Tom's sectors
- identify themes, hooks, opinions, pain points, and conversations worth creating content about
- cluster topics into usable content angles

### Required content focus areas
General UK recruitment:
- hiring trends
- salary expectations
- skills shortages
- interview behaviour
- candidate behaviour
- employer behaviour
- market slowdowns or shifts
- niche recruitment frustrations
- bad hiring habits
- recruiter pain points
- employer pain points
- talent availability

Sector-specific areas:
- building materials
- industrial engineering
- M&E engineering
- wholesale building materials
- minerals
- construction-adjacent hiring
- other Tom-defined niches in configuration

### Research output format
Each research cycle should ideally produce structured output such as:
- topic
- why it matters
- evidence or source summary
- suggested post angle
- confidence score or relevance score
- target platforms
- urgency/freshness indicator

### Research rules
- focus on UK relevance unless configured otherwise
- prefer commercially useful themes over fluff
- prioritise actionable or opinion-worthy angles
- do not just scrape random noise
- avoid obvious low-value reposting

---

## 10.4 Topic Selection and Scoring Module

### Purpose
Choose which discovered topics should be turned into posts.

### Responsibilities
- score candidate topics
- rank by relevance
- rank by likely engagement value
- align with Tom's sectors and commercial interests
- avoid duplication with recent posting history

### Topic scoring factors
- relevance to recruitment
- relevance to UK market
- relevance to Tom's sectors
- freshness
- likely engagement potential
- commercial usefulness
- originality relative to recent posts
- discussion potential
- authority-building potential

### Future extension
This module should later be able to incorporate actual engagement performance from previously published posts.

---

## 10.5 Content Generation Module

### Purpose
Turn selected topics into original, platform-specific content.

### Responsibilities
- generate original content from trend themes and source insights
- maintain message consistency across channels
- vary structure, length, tone, and formatting by platform
- reflect Tom's preferred communication style
- avoid low-value generic AI copy

### Core output rule
The same message or theme may be used across platforms, but each platform's post must be adapted rather than duplicated.

### Brand voice requirements
The output should generally be:
- commercially sharp
- direct
- credible
- useful
- opinionated where appropriate
- concise where possible
- relevant to UK recruitment
- natural rather than robotic

Where a stronger Tom-style tone is required, the model should lean toward:
- straightforward
- witty where appropriate
- blunt but not reckless
- commercially aware
- no fluff
- avoids cliché recruitment waffle

### Content generation quality rules
- no generic motivational filler unless explicitly requested
- no bloated paragraphs
- no fake certainty
- no invented statistics
- no bland "top tips" rubbish unless backed by a useful angle
- avoid repeating the same format every day
- avoid output that reads like obvious AI slop
- every post should have a reason to exist

---

## 10.6 Platform Formatting Module

### Purpose
Adapt the same underlying message to the demands of each social platform.

### LinkedIn requirements
- strongest professional/commercial framing
- often slightly longer
- strong opening hook
- structured for readability
- authority-building
- discussion-friendly
- suitable for recruiter, employer, and sector audience

### Facebook requirements
- more conversational
- accessible language
- community-friendly
- slightly simpler structure
- can be more relatable and less formal

### Instagram requirements
- shorter caption or more punchy wording
- visual-awareness in caption structure
- could support carousel-style captions later
- stronger opening line
- suitable for awareness and brand presence

### X requirements
- concise
- sharp
- provocative where useful
- punchier and faster
- can be more direct and stripped back

### General rules
- preserve core message
- adapt format, not just word count
- adapt CTA if any
- adapt hashtag usage by platform
- adapt line breaks and readability
- no identical copy pasted across all channels

---

## 10.7 Publishing Module

### Purpose
Send approved/generated posts to the correct platforms via PostFast.

### Responsibilities
- receive fully formatted post payloads
- publish to configured platforms
- log response and outcome
- retry where appropriate
- report failures clearly

### Platforms required
- LinkedIn
- Facebook
- Instagram
- X

### Nice to have / conditional
- Google Business Profile only if supported directly by the chosen publishing stack or via separate integration

### Publishing modes
The architecture should support:
- fully automatic publishing
- draft-only mode
- approval-required mode
- single-platform publish
- multi-platform publish

Even if all modes are not fully surfaced in the first UI, the code structure should support them.

---

## 10.8 Scheduler / Cron Module

### Purpose
Run configured tasks automatically at set times.

### Responsibilities
- trigger recurring workflows
- support different schedules per task
- avoid duplicate runs
- record run status
- notify Telegram on completion or failure

### Initial scheduled tasks
At minimum:
- morning research run
- content generation run
- publish run(s) at configured times
- summary/reporting message

### Scheduling requirements
Timing should be configurable.
The build should allow per-platform posting times later if needed.

### Important note on posting times
The system should be designed so posting times can be based on:
- static configured times at launch
- future optimisation logic based on performance or best-practice heuristics

Do not hard-code irreversible assumptions.

---

## 10.9 Business Task Execution Module

### Purpose
Handle ad hoc operational commands beyond social media.

### Launch expectation
This module may start light, but architecture should support meaningful expansion.

### Example future tasks
- email draft/reply workflows
- browser automation tasks
- admin tasks
- basic research tasks
- status reports
- document drafting
- inbox actions

### Example target request
"Open Outlook, find the email from XXX and reply saying something like XXXXX but in my tone."

### Important design rule
This module should not be tightly coupled to social posting logic.
It must be separate.

### Recommended implementation approach
Business tasks should be modelled as discrete capabilities or tools, for example:
- `email.reply`
- `email.search`
- `browser.open`
- `browser.navigate`
- `report.generate`
- `system.status`

This makes the system safer, easier to log, easier to permission, and easier to extend.

---

## 10.10 Logging and Observability Module

### Purpose
Make the system inspectable, debuggable, and trustworthy.

### Must log
- command received
- routed intent
- tools used
- research topics found
- posts generated
- platforms targeted
- publish results
- failure messages
- retry attempts
- timestamps
- triggering source (cron or Telegram)
- final outcome

### Nice to have
- execution duration
- model used
- token usage if available
- request IDs or run IDs
- per-platform status summary

### Logging rules
- logs must be structured, not vague strings only
- logs should make debugging straightforward
- avoid silent failure

---

## 10.11 Configuration Module

### Purpose
Keep business settings, content settings, posting settings, and secrets separate from core logic.

### Configuration should support
- brand/account names
- platform enable/disable flags
- posting schedules
- sectors to monitor
- target geography
- voice/tone presets
- research keywords
- platform-specific prompt instructions
- safe-mode/approval settings
- Telegram authorised user IDs
- feature flags

### Critical rule
Avoid scattering configuration across the codebase.
There should be a clear config layer.

---

## 11. Functional Requirements for Social Media Automation

## 11.1 Research Inputs

The social engine must research content and themes relevant to:
- UK recruitment market
- Tom's active sectors
- recruitment-related business pain points
- social conversations worth reacting to
- commercially useful market commentary
- employer and candidate behaviour patterns
- hiring strategy observations
- talent shortages and salary movement
- operational realities of recruitment

### Content source direction
The system should research trends and popular themes, but the objective is not to clone viral posts.

The correct process is:
1. identify what is working
2. understand why it is working
3. extract the underlying angle
4. generate an original IvyLens/Tom-aligned version

### Negative requirement
Do not simply paraphrase other creators' posts line by line.

---

## 11.2 Content Strategy Goals

Posts should aim to contribute to one or more of the following goals:
- build reach
- grow following
- build authority
- drive engagement
- show market understanding
- provoke discussion
- create brand familiarity
- support business development indirectly
- support ARG and related brand credibility

---

## 11.3 Content Categories

The system should support multiple content category types.

### A. Market insight posts
Examples:
- salary pressure
- candidate scarcity
- hiring slowdowns
- skills shortages

### B. Opinion posts
Examples:
- what employers get wrong
- what recruiters get wrong
- why hiring processes fail
- why good candidates disappear

### C. Educational posts
Examples:
- practical hiring advice
- job ad mistakes
- interview advice
- recruitment myths

### D. Sector-specific commentary
Examples:
- aggregates hiring challenges
- engineering recruitment trends
- building materials workforce issues

### E. Contrarian or debate-led posts
Examples:
- challenging popular assumptions
- disagreeing with lazy industry advice
- commenting on broken norms

### F. Light personal brand posts
Only where appropriate and configured.
These should still align with Tom's commercial positioning.

---

## 11.4 Posting Frequency

This should be configurable.

Initial architecture should support:
- daily posting
- multiple posts per day
- weekday-only schedules
- per-platform schedules
- campaign-specific bursts

The system must not assume one post per day forever.

---

## 11.5 Duplicate Avoidance

The system should avoid:
- repeating the same message too often
- posting near-identical angles across consecutive days
- overusing the same CTA
- sounding formulaic

This requires awareness of recent post history.

---

## 11.6 Approval and Safety Modes

The architecture should support:
- full autonomous mode
- review-before-publish mode
- draft and send-to-Telegram mode
- emergency pause mode

Even if v1 defaults to one mode, these modes should be structurally possible.

---

## 12. Functional Requirements for Telegram Control

## 12.1 Basic Behaviours

Tom should be able to:
- trigger manual runs
- ask for ideas
- request drafts
- ask what posted
- request system status
- turn automations on/off
- later issue business task commands

## 12.2 Response Style

System responses back to Telegram should be:
- concise
- clear
- practical
- include result or failure state
- include key details, not walls of text

## 12.3 Example Telegram interactions

### Example 1
**Tom:** "Run today's LinkedIn post now"

**System:** "Done. Researched 8 topics, selected 1, generated LinkedIn version, published successfully at 09:42."

### Example 2
**Tom:** "Give me 5 post ideas around engineering salary inflation"

**System:** returns 5 ranked ideas with short summaries.

### Example 3
**Tom:** "Pause all auto posting until tomorrow morning"

**System:** confirms schedule pause.

### Example 4
**Tom:** "Reply to the email from James at ABC and say we can do Thursday, but make it sound like me"

**System:** either executes if that capability exists, or states it is not yet enabled.

---

## 13. Data and Persistence Requirements

The system should persist enough data to be useful and stable.

### Data to store
- run history
- posts generated
- posts published
- research results
- topic scores
- per-platform output
- errors
- command history
- settings/config where appropriate

### Suggested persistence options
Vercel-compatible storage or external lightweight DB may be used depending on implementation choice.

The implementation should not rely solely on ephemeral memory.

### Reason
Without persistence:
- duplication avoidance becomes weak
- reporting becomes weak
- debugging becomes painful
- future optimisation becomes harder

---

## 14. Security Requirements

This is not optional.

### Telegram security
- restrict commands to authorised Telegram user IDs
- reject unauthorised senders
- validate webhook origin where possible

### API security
- validate environment variables at startup
- never expose secrets in logs or client-side code
- secure internal admin endpoints

### Publishing safety
- support dry-run or draft mode
- log publish attempts and results
- allow emergency shutoff

### Principle of least privilege
Each external integration should be granted only the permissions it needs.

---

## 15. Reliability Requirements

The system must be designed for practical reliability.

### Reliability expectations
- clear error handling
- retries where sensible
- no infinite loops
- no duplicate posting from repeat cron triggers
- timeout handling
- partial failure reporting

### Example
If Tavily research succeeds but PostFast fails, the system should:
- log the failure
- report the failure to Telegram
- avoid pretending the task completed

---

## 16. Non-Functional Requirements

## 16.1 Performance
- fast enough for conversational use
- scheduled workflows should complete in a reasonable time
- avoid unnecessary heavy chains for simple tasks

## 16.2 Maintainability
- modular code
- clean naming
- minimal duplication
- configuration-driven
- easy to inspect and extend

## 16.3 Scalability
- easy to add new social platforms
- easy to add new business task modules
- easy to add new brands or voices later
- easy to add approval workflows later

## 16.4 Deployability
- straightforward GitHub -> Vercel deployment
- environment variables clearly documented
- cron setup documented
- webhook setup documented

---

## 17. Voice and Tone Specification for Generated Content

The generated social content should usually reflect a mix of the following characteristics:

- UK business/recruitment relevance
- commercially sharp
- not corporate waffle
- direct
- intelligent
- plain English over jargon where possible
- opinion-led where useful
- avoids cringe motivational nonsense
- avoids fake guru language
- useful, readable, credible

### Tom-style guidance
Where instructed to write in Tom's tone:
- blunt
- witty when appropriate
- confident
- commercially aware
- no fluff
- no generic "thought leader" drivel
- no over-polished American SaaS tone
- sounds like a real operator

### UK language requirement
Use UK spelling and UK phrasing by default.

---

## 18. Product Operating Modes

The system should conceptually support the following modes:

### Mode 1: Fully automatic
Research, generate and publish without approval.

### Mode 2: Generate then send to Telegram for approval
Tom reviews before publish.

### Mode 3: Draft only
Create posts and save/log them without publishing.

### Mode 4: Manual command mode
Tom triggers specific actions as needed.

### Mode 5: Hybrid
Cron handles normal posting while Telegram handles exceptions and ad hoc tasks.

Hybrid should be considered the preferred real-world operating model.

---

## 19. Future Capability Expansion Plan

This section is here so architecture does not block future growth.

Potential later modules:
- Outlook / Microsoft Graph integration
- Gmail integration
- browser automation capability
- ATS connector
- CRM connector
- analytics and best-time learning
- approval buttons in Telegram
- performance scoring by platform
- media generation support
- multi-brand switching
- multi-user authorisation
- admin dashboard
- role-based permissions
- white-label capability
- client SaaS packaging

The current build does not need to fully implement all of these, but should not be written in a way that makes them painful later.

---

## 20. Development Principles for Cline

Cline must follow these build principles when implementing the system:

### 20.1 Build for production-minded use, not just proof of concept
The code must be structured as if it will become a real IvyLens product.

### 20.2 Keep responsibilities separated
Do not blend Telegram handling, content generation, publishing, and business task logic into one file.

### 20.3 Prefer modular services
Use clearly named services, modules, or agents.

### 20.4 Avoid hard-coded assumptions
Posting times, platforms, brand settings, sectors, and modes should be configurable.

### 20.5 Create clear extension points
Business tasks should be pluggable.

### 20.6 Keep logs useful
Every meaningful action should be traceable.

### 20.7 Do not invent unsupported features
If a platform or action is not supported by the current toolchain, represent that clearly in code and comments.

### 20.8 Design for controlled autonomy
The system should be autonomous where useful, but not reckless.

---

## 21. Suggested Repository Structure

This is a suggested structure, not an absolute mandate, but the same architectural separation must be preserved.

```text
/apps or /src
  /api
    /telegram
    /cron
    /social
    /system
  /agents
    socialResearchAgent
    contentGenerationAgent
    publishingAgent
    commandRouterAgent
    businessTaskAgent
  /services
    tavily
    groq
    postfast
    telegram
    logging
    storage
  /config
    platforms
    schedules
    prompts
    sectors
    env
  /lib
    helpers
    validators
    formatters
  /data or /db
    schemas
    repositories
  /docs
    source-of-truth.md
    setup.md
    environment.md
    cron.md
```

---

## 22. Environment and Secrets Expectations

The system will use environment variables for external integrations and secrets.

At minimum, the build should anticipate variables for:
- Groq API credentials
- Tavily API credentials
- PostFast API credentials
- Telegram bot token
- Telegram allowed user IDs
- internal admin secret if needed
- base app URL / deployment URL
- cron secret if required by chosen setup

Cline should document required variables and validate them at runtime.

---

## 23. Error Handling Expectations

Every major workflow must handle:
- missing configuration
- failed research API calls
- malformed generation responses
- publishing failures
- Telegram send failures
- unsupported command types
- rate limiting
- duplicate trigger attempts

The system must fail clearly rather than silently.

---

## 24. Reporting Expectations

At minimum, the system should be able to report:
- what ran
- when it ran
- what topics were selected
- what was posted
- which platforms succeeded
- what failed

A Telegram summary message after scheduled runs is highly desirable.

---

## 25. Practical V1 Build Target

The realistic and recommended first full milestone is:

### V1 milestone
A deployed Vercel-hosted IvyLens system that:
- receives Telegram messages
- supports a command router
- runs scheduled social research and publishing workflows
- researches UK recruitment and sector trends
- generates platform-specific posts in Tom's tone
- publishes across LinkedIn, Facebook, Instagram and X via PostFast
- logs actions and failures
- reports outcomes to Telegram

### V1.1 milestone
- approval mode
- duplicate avoidance improvements
- more advanced topic scoring
- better execution history

### V1.2 milestone
- early business task support
- one non-social task integration

---

## 26. What Good Looks Like

A good implementation will feel like this:

Tom wakes up.
The system has already researched the market.
It has selected a sensible topic.
It has generated strong platform-specific posts.
It has published them at the right times.
It has sent a concise Telegram summary.
If Tom wants something ad hoc, he messages Telegram and the system either does it or clearly says why it cannot.

That is the standard.

Not:
- a messy chain of prompts
- brittle scripts
- duplicated posts everywhere
- mystery failures
- random AI drivel posted on company channels

---

## 27. Explicit Anti-Goals

The following should be actively avoided:

- one giant monolithic agent file
- vague "AI magic" without structured routing
- raw copy-paste reposting of trending content
- identical posts across all platforms
- Americanised generic copy that does not sound like Tom
- hidden assumptions in code
- silent errors
- no logging
- no persistence
- no config layer
- overengineering the first version into paralysis
- underengineering it into a toy

---

## 28. Final Instruction to the Builder

This system should be built as a practical, extensible, cloud-based IvyLens operator.

The first job is to automate social media management properly.
The second job is to provide a Telegram-based command layer.
The third job is to create the foundation for wider business-task automation.

Everything in the implementation should move toward:
- automation
- reliability
- clarity
- brand fit
- extensibility
- real business usefulness

If uncertain, choose the option that:
- keeps the system modular
- keeps the system inspectable
- keeps the system deployable
- keeps the system commercially useful
- keeps future expansion possible

---

## 29. One-Line Product Definition

**IvyLens is a cloud-based AI business operator that autonomously researches, generates, formats and publishes social content, while also allowing Tom to trigger and manage business tasks conversationally through Telegram.**
