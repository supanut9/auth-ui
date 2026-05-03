import {
  ArrowLeft,
  ArrowRight,
  Bug,
  CheckCircle2,
  GitBranch,
  Globe2,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

import { appConfig } from "./config"
import type { FlowActionResult, FlowContext, FlowStage } from "./flow"
import {
  acceptConsent,
  globalLogout,
  loadFlowContext,
  localLogout,
  rejectConsent,
  resendOtp,
  startGitHubLogin,
  startGoogleLogin,
  startOtp,
  verifyOtp,
} from "./flow"
import { getUiRoute, type UiRoute } from "./routes"

type FlowPanelState =
  | { status: "loading"; flow: null; error: null }
  | { status: "ready"; flow: FlowContext | null; error: null }
  | { status: "error"; flow: null; error: string }

type StageView = "login" | "consent" | "otp" | "transition" | "error"

function App() {
  const route = getUiRoute(window.location.pathname)
  const searchParams = new URLSearchParams(window.location.search)
  const requestId = searchParams.get("request_id") ?? ""
  const emailParam = searchParams.get("email") ?? ""

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <HeroPanel />
        <AuthPage route={route} requestId={requestId} emailParam={emailParam} />
      </section>
      <FooterBand />
      <DevPanel requestId={requestId} />
    </main>
  )
}

function HeroPanel() {
  return (
    <Card className="relative overflow-hidden border-white/80 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.26),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_28%),linear-gradient(140deg,rgba(255,255,255,0.95),rgba(255,250,240,0.86))]">
      <CardContent className="flex h-full flex-col justify-between p-8 sm:p-10">
        <div className="max-w-2xl space-y-6">
          <Badge className="w-fit">Secure sign in</Badge>
          <div className="space-y-3">
            <h1 className="max-w-xl text-5xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-6xl">
              {appConfig.appName}
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              A calm, trusted sign-in surface for account access, consent, and email verification.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Pill icon={<ShieldCheck className="size-4" />} label="Private by default" />
            <Pill icon={<Mail className="size-4" />} label="Email verification" />
            <Pill icon={<Sparkles className="size-4" />} label="Fast repeat sign-in" />
          </div>

          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <PromiseCard
              icon={<LockKeyhole className="size-4" />}
              title="Central session"
              text="Once you're signed in, trusted sessions can move faster without asking for credentials again."
            />
            <PromiseCard
              icon={<Globe2 className="size-4" />}
              title="One surface"
              text="Every step keeps the same tone and layout, so the flow feels consistent from sign-in to approval."
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type AuthPageProps = {
  route: UiRoute
  requestId: string
  emailParam: string
}

function AuthPage({ route, requestId, emailParam }: AuthPageProps) {
  const [panelState, setPanelState] = useState<FlowPanelState>(() =>
    requestId
      ? { status: "loading", flow: null, error: null }
      : { status: "ready", flow: null, error: null },
  )
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function run() {
      if (!requestId) {
        setPanelState({ status: "ready", flow: null, error: null })
        return
      }

      setPanelState({ status: "loading", flow: null, error: null })
      const result = await loadFlowContext(requestId)
      if (!active) return

      if (result.ok) {
        setPanelState({ status: "ready", flow: result.flow, error: null })
        return
      }

      setPanelState({ status: "error", flow: null, error: result.message })
    }

    void run()

    return () => {
      active = false
    }
  }, [requestId])

  if (panelState.status === "loading") {
    return (
      <ShellCard
        route={route}
        title="Loading"
        subtitle="Preparing your sign-in experience."
        requestId={requestId}
      >
        <EmptyHint>
          One moment while we load the next step.
        </EmptyHint>
      </ShellCard>
    )
  }

  if (panelState.status === "error") {
    return <ErrorPage flow={null} requestId={requestId} detail={panelState.error} />
  }

  const flow = panelState.flow

  if (route === "/logout") {
    return <LogoutPage requestId={requestId} global={false} setMessage={setMessage} />
  }

  if (route === "/logout/global") {
    return <LogoutPage requestId={requestId} global setMessage={setMessage} />
  }

  if (route === "/error") {
    return <ErrorPage flow={flow} requestId={requestId} detail={message} />
  }

  switch (getStageView(flow?.stage, route)) {
    case "consent":
      return (
        <ConsentPage
          key={flow?.request_id || requestId || "consent"}
          flow={flow}
          requestId={requestId}
          message={message}
          setMessage={setMessage}
        />
      )
    case "otp":
      return (
        <OtpPage
          key={flow?.request_id || requestId || "otp"}
          flow={flow}
          requestId={requestId}
          emailParam={emailParam}
          message={message}
          setMessage={setMessage}
        />
      )
    case "transition":
      return <TransitionPage flow={flow} requestId={requestId} />
    case "error":
      return <ErrorPage flow={flow} requestId={requestId} detail={message} />
    case "login":
    default:
      return (
        <LoginPage
          key={flow?.request_id || requestId || "login"}
          flow={flow}
          requestId={requestId}
          message={message}
          setMessage={setMessage}
        />
      )
  }
}

function getStageView(stage: FlowStage | undefined, route: UiRoute): StageView {
  if (!stage) {
    return route === "/consent" ? "consent" : route === "/otp" ? "otp" : "login"
  }

  switch (stage) {
    case "login_required":
      return "login"
    case "provider_redirect":
    case "authorization_ready":
    case "completed":
      return "transition"
    case "otp_required":
      return "otp"
    case "consent_required":
      return "consent"
    case "failed":
    case "expired":
      return "error"
  }
}

type PageProps = {
  flow: FlowContext | null
  requestId: string
}

type FlowMessageProps = {
  message: string | null
  setMessage: (message: string | null) => void
}

function LoginPage({ flow, requestId, message, setMessage }: PageProps & FlowMessageProps) {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState<"google" | "github" | "otp" | null>(null)

  const loginMethods = flow?.available_login_methods ?? ["google", "github", "email_otp"]
  const canAct = Boolean(requestId)

  return (
    <ShellCard
      route="/login"
      title={flow ? `Continue to ${flow.client.display_name}` : "Sign in"}
      subtitle="Choose the account that should carry this session."
      requestId={requestId}
      flow={flow}
      message={message}
    >
      {!canAct && (
        <EmptyHint>
          Start from the application you were signing in to so this page can load properly.
        </EmptyHint>
      )}

      <AccountSummary flow={flow} />

      <div className="grid gap-3">
        {loginMethods.includes("google") && (
          <Button
            size="lg"
            className="justify-between rounded-2xl bg-slate-950 px-5 text-left"
            disabled={!canAct}
            onClick={async () => {
              if (!canAct) return setMessage("Missing request_id.")
              setMessage(null)
              setBusy("google")
              const result = await startGoogleLogin(requestId)
              setBusy(null)
              handleActionResult(result, setMessage)
            }}
          >
            <span className="flex items-center gap-3">
              <GoogleGlyph />
              Sign in with Google
            </span>
            {busy === "google" ? "Working..." : <ArrowRight className="size-4" />}
          </Button>
        )}

        {loginMethods.includes("github") && (
          <Button
            size="lg"
            variant="outline"
            className="justify-between rounded-2xl border-slate-300 bg-white/90 px-5 text-left"
            disabled={!canAct}
            onClick={async () => {
              if (!canAct) return setMessage("Missing request_id.")
              setMessage(null)
              setBusy("github")
              const result = await startGitHubLogin(requestId)
              setBusy(null)
              handleActionResult(result, setMessage)
            }}
          >
            <span className="flex items-center gap-3">
              <GitBranch className="size-5" />
              Sign in with GitHub
            </span>
            {busy === "github" ? "Working..." : <ArrowRight className="size-4" />}
          </Button>
        )}
      </div>

      {loginMethods.includes("email_otp") && (
        <>
          <Separator className="my-6" />
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault()
              if (!canAct) return setMessage("Missing request_id.")
              setMessage(null)
              setBusy("otp")
              const result = await startOtp(requestId, email.trim())
              setBusy(null)
              if (result.ok && !result.authorizationUrl && !result.redirectTo) {
                setMessage("Verification code sent. Enter the code on the OTP page.")
                window.location.assign(
                  `${appConfig.authUiUrl}/otp?request_id=${encodeURIComponent(requestId)}&email=${encodeURIComponent(email.trim())}`,
                )
                return
              }
              handleActionResult(result, setMessage)
            }}
          >
            <FieldLabel
              title="Email OTP"
              description="Get a one-time code by email to continue without using a social login."
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                disabled={!canAct}
                className="flex-1"
              />
              <Button
                type="submit"
                size="lg"
                className="rounded-2xl px-5 sm:w-auto"
                disabled={!canAct}
              >
                {busy === "otp" ? "Sending..." : "Send OTP"}
              </Button>
            </div>
          </form>
        </>
      )}
    </ShellCard>
  )
}

function ConsentPage({ flow, requestId, message, setMessage }: PageProps & FlowMessageProps) {
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null)
  const canAct = Boolean(requestId)

  return (
    <ShellCard
      route="/consent"
      title={flow ? `${flow.client.display_name} needs your approval` : "Review access"}
      subtitle="Review the scopes, account hint, and session choice before you allow access."
      requestId={requestId}
      flow={flow}
      message={message}
    >
      {!canAct && (
        <EmptyHint>
          Open this page from the active sign-in flow so approval can be submitted safely.
        </EmptyHint>
      )}

      <div className="space-y-5">
        <div className="rounded-3xl border border-border/70 bg-secondary/35 p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <span className="text-sm font-medium text-slate-800">Requested access</span>
          </div>
          <ScopeList scopes={flow?.requested_scopes ?? []} />
        </div>

        <AccountSummary flow={flow} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            disabled={!canAct}
            onClick={async () => {
              if (!canAct) return setMessage("Missing request_id.")
              setMessage(null)
              setBusy("accept")
              const result = await acceptConsent(requestId)
              setBusy(null)
              handleActionResult(result, setMessage)
            }}
          >
            {busy === "accept" ? "Approving..." : "Allow access"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={!canAct}
            onClick={async () => {
              if (!canAct) return setMessage("Missing request_id.")
              setMessage(null)
              setBusy("reject")
              const result = await rejectConsent(requestId)
              setBusy(null)
              handleActionResult(result, setMessage)
            }}
          >
            {busy === "reject" ? "Rejecting..." : "Deny access"}
          </Button>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          Allow only if you trust this application and understand the requested access.
        </p>
      </div>
    </ShellCard>
  )
}

function OtpPage({
  flow,
  requestId,
  emailParam,
  message,
  setMessage,
}: PageProps &
  FlowMessageProps & {
    emailParam: string
  }) {
  const [email, setEmail] = useState(emailParam || "")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null)
  const canAct = Boolean(requestId)

  return (
    <ShellCard
      route="/otp"
      title="Check your email"
      subtitle="Enter the one-time code tied to this sign-in session."
      requestId={requestId}
      flow={flow}
      message={message}
    >
      <div className="mb-6 rounded-3xl border border-amber-200/70 bg-amber-50/80 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-amber-100 p-2 text-amber-900">
            <KeyRound className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-950">Check your inbox</p>
            <p className="text-sm leading-6 text-amber-900/85">
              Use the latest code we sent. If you ask for another one, earlier codes stop working.
            </p>
          </div>
        </div>
      </div>

      <AccountSummary flow={flow} />

      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!canAct) return setMessage("Missing request_id.")
          setMessage(null)
          setBusy("verify")
          const result = await verifyOtp(requestId, email.trim(), code.trim())
          setBusy(null)
          handleActionResult(result, setMessage)
        }}
      >
        <div className="space-y-4">
          <LabeledField title="Email">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              disabled={!canAct}
            />
          </LabeledField>

          <LabeledField title="OTP code">
            <Input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              disabled={!canAct}
            />
          </LabeledField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="submit" size="lg" disabled={!canAct}>
            {busy === "verify" ? "Verifying..." : "Continue"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={!canAct}
            onClick={async () => {
              if (!canAct) return setMessage("Missing request_id.")
              setMessage(null)
              setBusy("resend")
              const result = await resendOtp(requestId, email.trim())
              setBusy(null)
              if (result.ok && !result.authorizationUrl && !result.redirectTo) {
                setMessage("Verification code resent.")
                return
              }
              handleActionResult(result, setMessage)
            }}
          >
            {busy === "resend" ? "Resending..." : "Send another code"}
          </Button>
        </div>
      </form>
    </ShellCard>
  )
}

function LogoutPage({
  requestId,
  global,
  setMessage,
}: {
  requestId: string
  global: boolean
  setMessage: (message: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const redirectUrl = global ? globalLogout() : localLogout()

  return (
    <ShellCard
      route={global ? "/logout/global" : "/logout"}
      title={global ? "Sign out everywhere" : "Sign out"}
      subtitle={
        global
          ? "End your central session and require a fresh sign-in across connected apps."
          : "End the session only for this browser and this app."
      }
      requestId={requestId}
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Choose whether to sign out from just this app or from every connected session. The local option clears only this app's browser session; the global option ends the central sign-in session too.
        </p>
        <Button
          size="lg"
          className="w-full sm:w-auto"
          variant={global ? "destructive" : "default"}
          onClick={async () => {
            setMessage(null)
            setBusy(true)
            const result = redirectUrl
            setBusy(false)
            handleActionResult(result, setMessage)
          }}
        >
          <LogOut className="size-4" />
          {busy
            ? "Working..."
            : global
              ? "Sign out everywhere"
              : "Sign out from this app"}
        </Button>
        <div className="rounded-3xl border border-border/70 bg-secondary/25 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-slate-900">
            <UserRound className="size-4 text-primary" />
            Session behavior
          </div>
          <p className="mt-2 leading-6">
            Local sign-out keeps the platform session intact for other connected apps. Global sign-out removes the central session and any linked browser trust.
          </p>
        </div>
      </div>
    </ShellCard>
  )
}

function TransitionPage({ flow, requestId }: PageProps) {
  const stage = flow?.stage
  const title =
    stage === "provider_redirect"
      ? "Redirecting to provider"
      : stage === "authorization_ready"
        ? "Completing authorization"
        : "Authorization complete"
  const subtitle =
    stage === "provider_redirect"
      ? "auth-server is sending the browser to the external login provider."
      : stage === "authorization_ready"
        ? "Consent is complete. auth-server should issue the authorization code next."
        : "auth-server should redirect the browser back to the client now."

  return (
    <ShellCard
      route="/login"
      title={title}
      subtitle={subtitle}
      requestId={requestId}
      flow={flow}
    >
      <div className="flex items-center gap-3 rounded-3xl border border-border/70 bg-secondary/30 p-5">
        <div className="size-3 animate-pulse rounded-full bg-primary" />
        <p className="text-sm text-muted-foreground">
          This is a transitional step. The browser should not remain here for long.
        </p>
      </div>
    </ShellCard>
  )
}

function ErrorPage({
  flow,
  requestId,
  detail,
}: PageProps & {
  detail: string | null
}) {
  const isExpired =
    flow?.stage === "expired" ||
    detail?.toLowerCase().includes("sign-in request expired") === true
  const isFailed = flow?.stage === "failed"

  return (
    <ShellCard
      route="/error"
      title={
        isExpired
          ? "This sign-in request expired"
          : isFailed
            ? "This sign-in request was rejected"
            : "We couldn't complete sign-in"
      }
      subtitle={
        isExpired
          ? "Start a fresh sign-in from the application."
          : isFailed
            ? "The flow was stopped before completion."
            : "Something interrupted the flow before it could finish."
      }
      requestId={requestId}
      flow={flow}
      message={detail}
    >
      <div className="space-y-4">
        <EmptyHint>
          {isExpired
            ? "The request timed out or was completed elsewhere. Go back to the application and start sign-in again."
            : isFailed
              ? "Approval was denied or the request was invalid. Start a new sign-in from the application."
              : "Try returning to the application and starting sign-in again."}
        </EmptyHint>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.history.back()
            }}
          >
            <ArrowLeft className="size-4" />
            Go back
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (isExpired) {
                window.location.assign(appConfig.defaultAppLoginUrl)
                return
              }
              window.location.reload()
            }}
          >
            <RotateCcw className="size-4" />
            {isExpired ? "Start new sign-in" : "Retry current page"}
          </Button>
        </div>
      </div>
    </ShellCard>
  )
}

function ShellCard({
  route,
  title,
  subtitle,
  requestId,
  flow,
  message,
  children,
}: {
  route: UiRoute
  title: string
  subtitle: string
  requestId: string
  flow?: FlowContext | null
  message?: string | null
  children?: ReactNode
}) {
  return (
    <Card className="border-slate-200/80 bg-white/88">
      <CardHeader className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="outline">{route}</Badge>
          {requestId && <Badge variant="secondary">Request active</Badge>}
        </div>
        <div className="space-y-2">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </div>
        {flow && <FlowSnapshot flow={flow} />}
        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function AccountSummary({ flow }: { flow: FlowContext | null }) {
  if (!flow?.account_hint) {
    return null
  }

  const displayName =
    flow.account_hint.display_name?.trim() || flow.account_hint.email?.trim() || "Linked account"

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-white p-2 text-primary shadow-sm">
          <UserRound className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">Known account</p>
          <p className="mt-1 truncate text-sm text-slate-600">{displayName}</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        This request already knows the linked identity hint for the current sign-in session.
      </p>
    </div>
  )
}

function FlowSnapshot({ flow }: { flow: FlowContext }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SnapshotItem label="Client" value={flow.client.display_name} />
      <SnapshotItem label="Step" value={humanStage(flow.stage)} />
      <SnapshotItem label="Scopes" value={flow.requested_scopes.join(" ") || "none"} />
      <SnapshotItem
        label="Account hint"
        value={flow.account_hint?.display_name ?? flow.account_hint?.email ?? "none"}
      />
    </div>
  )
}

function ScopeList({ scopes }: { scopes: string[] }) {
  if (scopes.length === 0) {
    return <EmptyHint>No scopes were requested on this flow.</EmptyHint>
  }

  const descriptions: Record<string, string> = {
    openid: "Finish secure sign-in.",
    email: "View your verified email address.",
    profile: "View your basic profile details.",
    "trading.read": "Read information associated with your account.",
    "trading.write": "Create and manage actions on your behalf.",
  }

  return (
    <div className="grid gap-3">
      {scopes.map((scope) => (
        <div
          key={scope}
          className="rounded-2xl border border-border/70 bg-white/80 px-4 py-3 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-4 text-primary" />
            <div className="space-y-1">
              <div className="text-sm font-medium text-slate-900">{scope}</div>
              <div className="text-sm text-muted-foreground">
                {descriptions[scope] ?? "Access requested by this application."}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SnapshotItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/30 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-medium text-slate-900">{value}</div>
    </div>
  )
}

function PromiseCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/72 p-5 shadow-sm backdrop-blur">
      <div className="mb-3 inline-flex rounded-2xl bg-white/80 p-2 text-primary shadow-sm">
        {icon}
      </div>
      <div className="space-y-1.5">
        <div className="text-sm font-medium text-slate-900">{title}</div>
        <div className="text-sm leading-6 text-slate-600">{text}</div>
      </div>
    </div>
  )
}

function Pill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-4 py-2 text-sm text-slate-700 shadow-sm">
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

function LabeledField({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-900">{title}</span>
      {children}
    </label>
  )
}

function FieldLabel({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-slate-900">{title}</div>
      <div className="text-sm leading-6 text-muted-foreground">{description}</div>
    </div>
  )
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>
}

function FooterBand() {
  return (
    <Card className="border-white/70 bg-white/75">
      <CardContent className="flex flex-col gap-4 p-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="font-medium text-slate-900">Hosted by {appConfig.appName}</div>
          <div>Secure sign-in, approval, verification, and session choices in one place.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Google</Badge>
          <Badge variant="outline">GitHub</Badge>
          <Badge variant="outline">Email OTP</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function DevPanel({ requestId }: { requestId: string }) {
  const searchParams = new URLSearchParams(window.location.search)
  if (!import.meta.env.DEV || searchParams.get("debug") !== "1") {
    return null
  }

  return (
    <details className="group rounded-3xl border border-border/70 bg-white/60 p-5 text-sm text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-slate-700">
        <Bug className="size-4" />
        Developer details
      </summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SnapshotItem label="Auth Server" value={appConfig.authServerUrl} />
        <SnapshotItem label="Auth UI" value={appConfig.authUiUrl} />
        <SnapshotItem label="Request" value={requestId || "none"} />
      </div>
    </details>
  )
}

function GoogleGlyph() {
  return (
    <span className="inline-grid size-5 place-items-center rounded-full bg-white text-[10px] font-semibold text-slate-900">
      G
    </span>
  )
}

function handleActionResult(
  result: FlowActionResult,
  setMessage: (message: string | null) => void,
) {
  if (result.ok) {
    if (result.authorizationUrl) {
      window.location.assign(result.authorizationUrl)
      return
    }
    if (result.redirectTo) {
      window.location.assign(result.redirectTo)
      return
    }

    setMessage("Working...")
    return
  }

  setMessage(result.message)
}

export default App

function humanStage(stage: FlowStage): string {
  switch (stage) {
    case "login_required":
      return "Sign in"
    case "provider_redirect":
      return "Provider redirect"
    case "otp_required":
      return "Email verification"
    case "consent_required":
      return "Approval"
    case "authorization_ready":
      return "Completing"
    case "completed":
      return "Finished"
    case "failed":
      return "Error"
    case "expired":
      return "Expired"
  }
}
