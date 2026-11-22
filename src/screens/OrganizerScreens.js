import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Badge, Button, ConfirmDialog, LinkButton, Notice } from "../components.js";
import { useAuth } from "../auth.js";
import { useI18n } from "../i18n.js";
import { EVENT_STATUS_TONE, PHASES, PHASE_TONE } from "../models.js";
import { DateTimeField, EmptyState, H1, H2, Muted, ProgressBar, Screen, Section, SelectField, StatCard, StatGrid, UnderlineTabs } from "../ui.js";
import { colors } from "../theme.js";
import { EventEditor, PaidSalesActivation, StaffManager, TicketTypeManager } from "./OrganizerForms.js";

const percent = (v) => (v === null || v === undefined ? "—" : `${v}%`);

// ---------------- OrganizerDashboard ----------------
export function OrganizerDashboardScreen({ navigation }) {
  const { client } = useAuth();
  const { t, formatDate, formatKZT } = useI18n();
  const [dash, setDash] = useState(null);
  const [events, setEvents] = useState([]);
  const [phase, setPhase] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const reload = useCallback(async (quiet) => {
    if (quiet) setRefreshing(true);
    try {
      const [d, e] = await Promise.all([client.organizerDashboard(), client.organizerEvents()]);
      setDash(d);
      setEvents(e);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [client]);

  useFocusEffect(useCallback(() => { reload(false); }, [reload]));

  async function doAction(action, id) {
    setNotice(null);
    try {
      await client.eventAction(id, action);
      setNotice({ tone: "success", text: t(`manage.done.${action}`) });
      await reload(true);
    } catch (err) {
      setNotice({ tone: "error", text: t(`manage.failed.${action}`, { reason: err.message }) });
    }
  }

  const totals = dash?.totals;
  const list = (dash?.events ?? []).filter((a) => phase === "all" || a.event.phase === phase);

  return (
    <Screen refreshing={refreshing} onRefresh={() => reload(true)}>
      <View>
        <H1>{t("organizer.title")}</H1>
        <Muted>{t("organizer.subtitle")}</Muted>
      </View>
      <View style={st.btnWrap}>
        <Button small label={`+ ${t("organizer.newEvent")}`} onPress={() => navigation.navigate("ManageEvent", {})} />
        <Button small variant="outline" label={t("support.workspace")} onPress={() => navigation.navigate("SupportTab")} />
        <Button small variant="outline" label={t("support.contactPlatform")} onPress={() => navigation.navigate("NewCase", { platform: true })} />
      </View>

      {error ? <Notice tone="error">{t("organizer.loadFailed", { reason: error })}</Notice> : null}
      {notice ? <Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice> : null}
      {loading ? <Muted>{t("common.loading")}</Muted> : null}

      {totals ? (
        <>
          <StatGrid>
            <StatCard label={t("organizer.stats.events")} value={totals.events} sub={t("organizer.stats.eventsSub", { upcoming: totals.by_phase.upcoming, active: totals.by_phase.active })} />
            <StatCard label={t("organizer.stats.sold")} value={totals.tickets_sold}
              sub={totals.capacity ? t("organizer.stats.ofSeats", { count: totals.capacity }) : t("organizer.stats.unlimited")} />
            <StatCard label={t("organizer.stats.gross")} value={formatKZT(totals.gross_kzt)} sub={t("organizer.stats.discounts", { amount: formatKZT(totals.discounts_kzt) })} />
            <StatCard label={t("organizer.stats.net")} value={formatKZT(totals.net_kzt)} sub={t("organizer.stats.refunds", { amount: formatKZT(totals.refunds_kzt) })} />
            <StatCard label={t("organizer.stats.checkIn")} value={percent(totals.percent_checked_in)} sub={t("organizer.stats.came", { count: totals.checked_in })} />
            <StatCard label={t("organizer.stats.promo")} value={totals.promo_redemptions} sub={t("organizer.stats.redemptions")} />
          </StatGrid>

          <UnderlineTabs value={phase} onChange={setPhase}
            tabs={["all", ...PHASES].map((p) => ({
              value: p,
              label: p === "all" ? `${t("filters.all")} (${totals.events})` : `${t(`phase.${p}`)} (${totals.by_phase[p]})`
            }))} />

          {list.length === 0 ? <EmptyState>{totals.events === 0 ? t("organizer.noEvents") : t("organizer.noEventsInPhase")}</EmptyState> : null}
          {list.map((a) => {
            const id = a.event.id;
            const status = events.find((e) => e.id === id)?.status ?? a.event.status;
            return (
              <Section key={id}>
                <Pressable onPress={() => navigation.navigate("EventAnalytics", { eventId: id, title: a.event.title })}>
                  <Text style={st.eventTitle}>{a.event.title || t("organizer.untitled")}</Text>
                </Pressable>
                <Muted small>{formatDate(a.event.starts_at, a.event.timezone, "full")}</Muted>
                <View style={st.badges}>
                  <Badge tone={PHASE_TONE[a.event.phase]} label={t(`phase.${a.event.phase}`)} />
                  <Badge tone={EVENT_STATUS_TONE[status]} label={t(`eventStatus.${status}`)} />
                </View>
                <Text style={st.sales}>{t("organizer.table.sales")}: {a.capacity.sold} / {a.capacity.total ?? "∞"} ({percent(a.capacity.percent_sold)})</Text>
                <ProgressBar value={a.capacity.percent_sold} />
                <View style={st.metrics}>
                  <Muted small>{t("organizer.table.revenue")}: {formatKZT(a.revenue.net_kzt)}</Muted>
                  <Muted small>{t("organizer.stats.checkIn")}: {percent(a.attendance.percent_checked_in)}</Muted>
                </View>
                <View style={st.actions}>
                  <LinkButton label={t("organizer.analytics")} onPress={() => navigation.navigate("EventAnalytics", { eventId: id, title: a.event.title })} />
                  <LinkButton label={t("organizer.manage")} onPress={() => navigation.navigate("ManageEvent", { eventId: id })} />
                  <LinkButton label={t("tabs.checkin")} onPress={() => navigation.navigate("CheckinEvent", { event: { id, name: a.event.title, startsAt: a.event.starts_at, timezone: a.event.timezone, venue: "" } })} />
                  {status === "draft" ? <ActionLink color={colors.emerald700} label={t("manage.publish")} onPress={() => doAction("publish", id)} /> : null}
                  {status === "published" ? <ActionLink label={t("manage.unpublish")} onPress={() => doAction("unpublish", id)} /> : null}
                  {status !== "cancelled" ? (
                    <ActionLink color={colors.red600} label={t("manage.cancelEvent")}
                      onPress={() => setConfirm({ id, title: a.event.title })} />
                  ) : null}
                  <ActionLink color={colors.gray500} label={t("manage.preview")} onPress={() => navigation.navigate("EventDetails", { eventId: id })} />
                </View>
              </Section>
            );
          })}
        </>
      ) : null}

      <ConfirmDialog visible={!!confirm} danger title={t("manage.cancelEvent")}
        body={confirm ? t("manage.confirmCancel", { title: confirm.title }) : ""}
        confirmLabel={t("manage.cancelEvent")} cancelLabel={t("common.back")}
        onCancel={() => setConfirm(null)} onConfirm={() => { const c = confirm; setConfirm(null); doAction("cancel", c.id); }} />
    </Screen>
  );
}

function ActionLink({ label, onPress, color = colors.gray800 }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6}>
      <Text style={[st.actionLink, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------- EventAnalyticsPanel ----------------
export function EventAnalyticsScreen({ route, navigation }) {
  const { eventId, title } = route.params;
  const { client } = useAuth();
  const { t, formatKZT, lang } = useI18n();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeId, setTypeId] = useState("");
  const [types, setTypes] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [asTable, setAsTable] = useState(false);

  useEffect(() => { navigation.setOptions({ title: t("analytics.title", { title: title || "" }) }); }, [navigation, title, t]);

  useEffect(() => {
    client.organizerAnalytics(eventId, { date_from: dateFrom, date_to: dateTo, ticket_type_id: typeId })
      .then((d) => { setData(d); setError(""); if (!typeId && !dateFrom && !dateTo) setTypes(d.by_ticket_type); })
      .catch((e) => setError(e.message));
  }, [client, eventId, dateFrom, dateTo, typeId]);

  const a = data;
  const hasFilters = dateFrom || dateTo || typeId;
  const day = (iso) => { try { return new Date(`${iso}T00:00:00`).toLocaleDateString({ kk: "kk-KZ", ru: "ru-RU", en: "en-GB" }[lang], { day: "numeric", month: "short" }); } catch { return iso; } };

  return (
    <Screen>
      <Section>
        <View style={st.gap10}>
          <DateTimeField mode="date" label={t("analytics.dateFrom")} value={dateFrom} onChange={setDateFrom} />
          <DateTimeField mode="date" label={t("analytics.dateTo")} value={dateTo} onChange={setDateTo} />
          <SelectField label={t("analytics.ticketType")} value={typeId} onChange={setTypeId}
            options={[{ value: "", label: t("filters.all") }, ...types.map((tt) => ({ value: tt.ticket_type_id, label: tt.name }))]} />
          {hasFilters ? <LinkButton label={t("analytics.reset")} onPress={() => { setDateFrom(""); setDateTo(""); setTypeId(""); }} /> : null}
        </View>
      </Section>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!a ? <Muted>{t("common.loading")}</Muted> : (
        <>
          <StatGrid>
            <StatCard label={t("analytics.sold")} value={`${a.capacity.sold} / ${a.capacity.total ?? "∞"}`}
              sub={a.capacity.remaining !== null ? t("analytics.remaining", { count: a.capacity.remaining, percent: percent(a.capacity.percent_sold) }) : t("organizer.stats.unlimited")} />
            <StatCard label={t("organizer.stats.gross")} value={formatKZT(a.revenue.gross_kzt)} sub={t("analytics.orders", { count: a.revenue.orders })} />
            <StatCard label={t("organizer.stats.net")} value={formatKZT(a.revenue.net_kzt)}
              sub={`${t("organizer.stats.discounts", { amount: formatKZT(a.revenue.discounts_kzt) })}, ${t("organizer.stats.refunds", { amount: formatKZT(a.revenue.refunds_kzt) })}`} />
            <StatCard label={t("analytics.attendance")} value={`${a.attendance.checked_in} / ${a.attendance.absent}`}
              sub={`${t("organizer.stats.checkIn")} ${percent(a.attendance.percent_checked_in)}`} />
          </StatGrid>

          <Section title={t("analytics.salesByDay")} right={a.sales_over_time?.length ? <LinkButton label={asTable ? t("analytics.chart.showChart") : t("analytics.chart.showTable")} onPress={() => setAsTable(!asTable)} /> : null}>
            {!a.sales_over_time || a.sales_over_time.length === 0 ? <Muted>{t("analytics.chart.empty")}</Muted> : asTable ? (
              <View>
                <View style={st.tRow}><Text style={st.th}>{t("analytics.chart.day")}</Text><Text style={st.thR}>{t("analytics.chart.tickets")}</Text><Text style={st.thR}>{t("analytics.chart.total")}</Text><Text style={st.thR}>{t("analytics.chart.revenue")}</Text></View>
                {a.sales_over_time.map((p) => (
                  <View key={p.date} style={[st.tRow, st.tBorder]}>
                    <Text style={st.td}>{day(p.date)}</Text><Text style={st.tdR}>{p.tickets}</Text><Text style={st.tdR}>{p.cumulative_tickets}</Text><Text style={st.tdR}>{formatKZT(p.revenue_kzt)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <SalesBars points={a.sales_over_time} day={day} />
            )}
          </Section>

          <Section title={t("analytics.byType")}>
            {a.by_ticket_type.length === 0 ? <Muted>{t("analytics.noTypes")}</Muted> : null}
            {a.by_ticket_type.map((tt) => (
              <View key={tt.ticket_type_id} style={st.typeRow}>
                <View style={st.typeHead}>
                  <Text style={st.typeName}>{tt.name} · {tt.price_kzt > 0 ? formatKZT(tt.price_kzt) : t("common.free")}</Text>
                  <Text style={st.typeVal}>{tt.sold}/{tt.capacity ?? "∞"} · {formatKZT(tt.revenue_kzt)}</Text>
                </View>
                <ProgressBar value={tt.percent_sold} />
                <Muted small>{t("organizer.stats.checkIn")}: {tt.checked_in}</Muted>
              </View>
            ))}
          </Section>

          <Section title={t("organizer.stats.promo")}>
            {a.campaigns.length === 0 ? <Muted>{t("analytics.noPromo")}</Muted> : (
              <View>
                <View style={st.tRow}><Text style={st.th}>{t("analytics.code")}</Text><Text style={st.thR}>{t("analytics.redemptions")}</Text><Text style={st.thR}>{t("analytics.discount")}</Text><Text style={st.thR}>{t("organizer.table.revenue")}</Text></View>
                {a.campaigns.map((c) => (
                  <View key={c.code} style={[st.tRow, st.tBorder]}>
                    <Text style={[st.td, st.mono]}>{c.code}</Text><Text style={st.tdR}>{c.redemptions}</Text><Text style={st.tdR}>−{formatKZT(c.discount_kzt)}</Text><Text style={st.tdR}>{formatKZT(c.net_kzt)}</Text>
                  </View>
                ))}
              </View>
            )}
            <Muted small style={st.top8}>{t("analytics.cancellations", { cancelled: a.cancellations.cancelled, refunded: a.cancellations.refunded })}</Muted>
          </Section>
        </>
      )}
    </Screen>
  );
}

function SalesBars({ points, day }) {
  const max = Math.max(1, ...points.map((p) => p.tickets));
  const every = Math.ceil(points.length / 6);
  return (
    <View>
      <View style={st.chart}>
        {points.map((p) => (
          <View key={p.date} style={st.barCol}>
            <Text style={st.barNum}>{p.tickets}</Text>
            <View style={[st.barFill, { height: `${(p.tickets / max) * 80}%` }]} />
          </View>
        ))}
      </View>
      <View style={st.axis}>
        {points.map((p, i) => <Text key={p.date} style={st.axisText} numberOfLines={1}>{i % every === 0 ? day(p.date) : ""}</Text>)}
      </View>
    </View>
  );
}

// ---------------- EventManagePage ----------------
export function ManageEventScreen({ route, navigation }) {
  const eventId = route.params?.eventId;
  const { client } = useAuth();
  const { t, formatDate } = useI18n();
  const [event, setEvent] = useState(null);
  const [types, setTypes] = useState([]);
  const [state, setState] = useState(eventId ? "loading" : "ok");
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState(route.params?.tab || "details");
  const [notice, setNotice] = useState(route.params?.created ? { tone: "success", text: t("manage.createdNotice") } : null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const [all, tt] = await Promise.all([client.organizerEvents(), client.ticketTypes(eventId)]);
      const found = all.find((e) => e.id === eventId) ?? null;
      setEvent(found);
      setTypes(tt);
      setState(found ? "ok" : "missing");
    } catch (e) {
      setLoadError(e.message);
      setState("error");
    }
  }, [client, eventId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title: eventId ? (event?.title || t("organizer.manage")) : t("manage.newTitle") }); }, [navigation, event, eventId, t]);

  if (state === "loading") return <Screen><Muted>{t("common.loading")}</Muted></Screen>;
  if (state === "error") {
    return (
      <Screen>
        <Notice tone="error">{t("manage.loadFailed", { reason: loadError })}</Notice>
        <LinkButton label={t("common.retry")} onPress={() => { setState("loading"); load(); }} />
      </Screen>
    );
  }
  if (state === "missing") return <Screen><H1>{t("manage.notFound")}</H1></Screen>;

  if (!eventId || !event) {
    return (
      <Screen keyboard>
        <H1>{t("manage.newTitle")}</H1>
        <Muted>{t("manage.newHint")}</Muted>
        <Section>
          <EventEditor event={null} onSaved={(e) => navigation.replace("ManageEvent", { eventId: e.id, tab: "tickets", created: true })} />
        </Section>
      </Screen>
    );
  }

  const ev = event;
  const missingForPublish = [
    !ev.title?.trim() && t("manage.require.title"),
    !ev.starts_at && t("manage.require.date"),
    !(ev.venue_name || ev.venue_address) && t("manage.require.venue"),
    !types.some((x) => !x.is_hidden) && t("manage.require.ticketType")
  ].filter(Boolean);

  async function run(action) {
    if (action === "publish" && missingForPublish.length) {
      setNotice({ tone: "error", text: t("manage.cannotPublish"), items: missingForPublish });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const updated = await client.eventAction(ev.id, action);
      setEvent({ ...ev, ...updated });
      setNotice({ tone: "success", text: t(`manage.done.${action}`) });
    } catch (e) {
      setNotice({ tone: "error", text: t(`manage.failed.${action}`, { reason: e.message }) });
    } finally {
      setBusy(false);
    }
  }

  const cancelled = ev.status === "cancelled";
  const paidActive = ev.paid_sales_status === "ACTIVE";
  const hasPaid = types.some((tt) => (tt.price ?? 0) > 0);

  return (
    <Screen keyboard>
      <Section>
        <View style={st.badges}>
          <Badge tone={EVENT_STATUS_TONE[ev.status]} label={t(`eventStatus.${ev.status}`)} />
          <Badge tone="blue" label={t(`visibility.${ev.visibility ?? "public"}`)} />
          {hasPaid ? <Badge tone={paidActive ? "success" : "warning"} label={paidActive ? t("manage.paidActive") : t("manage.paidInactive")} /> : null}
        </View>
        <H2 style={st.top8}>{ev.title || t("organizer.untitled")}</H2>
        <Muted>{formatDate(ev.starts_at, ev.timezone ?? "Asia/Almaty", "full")} · {ev.venue_name}</Muted>
        <View style={st.btnWrapTop}>
          <Button small variant="outline" label={t("manage.preview")} onPress={() => navigation.navigate("EventDetails", { eventId: ev.id })} />
          {ev.status === "draft" ? <Button small variant="success" label={t("manage.publish")} disabled={busy} onPress={() => run("publish")} /> : null}
          {ev.status === "published" ? <Button small variant="outline" label={t("manage.unpublish")} disabled={busy} onPress={() => run("unpublish")} /> : null}
          {!cancelled ? <Button small variant="danger" label={t("manage.cancelEvent")} disabled={busy} onPress={() => setConfirmCancel(true)} /> : null}
        </View>
      </Section>

      {notice && !(notice.text === t("manage.cannotPublish") && missingForPublish.length === 0) ? (
        <Notice tone={notice.tone} items={notice.items} onClose={() => setNotice(null)}>{notice.text}</Notice>
      ) : null}

      {ev.status === "draft" ? (
        <Section title={t("manage.readyTitle")}>
          {[
            [Boolean(ev.title?.trim()), t("manage.require.title")],
            [Boolean(ev.starts_at), t("manage.require.date")],
            [Boolean(ev.venue_name || ev.venue_address), t("manage.require.venue")],
            [types.some((x) => !x.is_hidden), t("manage.require.ticketType")]
          ].map(([ok, label]) => <Text key={label} style={[st.ready, ok && st.readyOk]}>{ok ? "✓" : "○"} {label}</Text>)}
          <Muted small style={st.top8}>{t("manage.readyHint")}</Muted>
        </Section>
      ) : null}

      <UnderlineTabs value={tab} onChange={setTab} tabs={[
        { value: "details", label: t("manage.tabs.details") },
        { value: "tickets", label: `${t("manage.tabs.tickets")} (${types.length})` },
        { value: "paid", label: t("manage.tabs.paid") },
        { value: "staff", label: t("staff.tab") }
      ]} />

      <Section>
        {tab === "details" ? <EventEditor event={ev} onSaved={(saved) => setEvent({ ...ev, ...saved })} /> : null}
        {tab === "tickets" ? <TicketTypeManager eventId={ev.id} types={types} readOnly={cancelled} paidSalesActive={paidActive} onChange={setTypes} /> : null}
        {tab === "paid" ? (
          <PaidSalesActivation event={ev} types={types} onActivated={() => setEvent({ ...ev, paid_sales_status: "ACTIVE" })} onGoToTickets={() => setTab("tickets")} />
        ) : null}
        {tab === "staff" ? <StaffManager eventId={ev.id} readOnly={cancelled} /> : null}
      </Section>

      <ConfirmDialog visible={confirmCancel} danger title={t("manage.cancelEvent")} body={t("manage.confirmCancel", { title: ev.title })}
        confirmLabel={t("manage.cancelEvent")} cancelLabel={t("common.back")}
        onCancel={() => setConfirmCancel(false)} onConfirm={() => { setConfirmCancel(false); run("cancel"); }} />
    </Screen>
  );
}

const st = StyleSheet.create({
  btnWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btnWrapTop: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  eventTitle: { fontSize: 17, fontWeight: "600", color: colors.gray900 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  sales: { fontSize: 12, color: colors.gray700, marginTop: 10, marginBottom: 4 },
  metrics: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 },
  actionLink: { fontSize: 13, fontWeight: "600" },
  gap10: { gap: 10 },
  top8: { marginTop: 8 },
  tRow: { flexDirection: "row", paddingVertical: 6, gap: 6 },
  tBorder: { borderTopWidth: 1, borderTopColor: colors.gray100 },
  th: { flex: 1.2, fontSize: 12, color: colors.gray500 },
  thR: { flex: 1, fontSize: 12, color: colors.gray500, textAlign: "right" },
  td: { flex: 1.2, fontSize: 13, color: colors.gray800 },
  tdR: { flex: 1, fontSize: 13, color: colors.gray800, textAlign: "right" },
  mono: { fontFamily: "monospace" },
  typeRow: { marginBottom: 14, gap: 4 },
  typeHead: { flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  typeName: { fontSize: 14, fontWeight: "500", color: colors.gray900 },
  typeVal: { fontSize: 13, color: colors.gray700 },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 180, gap: 3, borderBottomWidth: 1, borderBottomColor: colors.gray300 },
  barCol: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end" },
  barNum: { fontSize: 10, color: colors.gray500, marginBottom: 2 },
  barFill: { width: "80%", maxWidth: 24, backgroundColor: colors.blue600, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  axis: { flexDirection: "row", gap: 3, marginTop: 4 },
  axisText: { flex: 1, fontSize: 9, color: colors.gray500, textAlign: "center" },
  ready: { fontSize: 14, color: colors.gray500, paddingVertical: 2 },
  readyOk: { color: colors.emerald700 }
});
