import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/auth.js";
import { I18nProvider, useI18n } from "./src/i18n.js";
import { NotificationsProvider, useNotifications } from "./src/notifications.js";
import { LanguageSwitcher } from "./src/components.js";
import { colors } from "./src/theme.js";
import DiscoverScreen from "./src/screens/DiscoverScreen.js";
import EventDetailsScreen from "./src/screens/EventDetailsScreen.js";
import CheckoutScreen from "./src/screens/CheckoutScreen.js";
import OrdersScreen from "./src/screens/OrdersScreen.js";
import OrderScreen from "./src/screens/OrderScreen.js";
import TicketScreen from "./src/screens/TicketScreen.js";
import { NewCaseScreen, NotificationsScreen, SupportCaseScreen, SupportListScreen } from "./src/screens/SupportScreens.js";
import { AccountScreen, ForgotScreen, ProfileScreen, SignInScreen, SignUpScreen } from "./src/screens/AccountScreens.js";
import { EventAnalyticsScreen, ManageEventScreen, OrganizerDashboardScreen } from "./src/screens/OrganizerScreens.js";
import { CheckinEventScreen, CheckinEventsScreen, ScanLogProvider } from "./src/screens/CheckinScreens.js";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.blue600, background: colors.gray50, card: colors.white, text: colors.gray900, border: colors.gray200 }
};

function Bell({ navigation }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { unreadCount } = useNotifications();
  if (!user) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t("notifications.label", { count: unreadCount })}
      onPress={() => navigation.navigate("Notifications")} hitSlop={8} style={st.bell}>
      <Ionicons name="notifications-outline" size={22} color={colors.gray700} />
      {unreadCount > 0 ? <View style={st.bellBadge}><Text style={st.bellText}>{unreadCount > 9 ? "9+" : unreadCount}</Text></View> : null}
    </Pressable>
  );
}

// Web navbar: blue "BiletFlow" wordmark left; bell + KK/RU/EN right.
function tabHeader(navigation) {
  return {
    headerTitle: () => <Text style={st.brand}>BiletFlow</Text>,
    headerTitleAlign: "left",
    headerRight: () => (
      <View style={st.headerRight}>
        <Bell navigation={navigation} />
        <LanguageSwitcher />
      </View>
    ),
    headerShadowVisible: true,
    headerStyle: { backgroundColor: colors.white }
  };
}

const ICONS = {
  EventsTab: "calendar-outline", TicketsTab: "ticket-outline", CheckinTab: "qr-code-outline",
  OrganizerTab: "bar-chart-outline", SupportTab: "chatbubbles-outline", AccountTab: "person-circle-outline"
};

function Tabs() {
  const { user, isStaff, isOrganizer } = useAuth();
  const { t } = useI18n();
  const { unreadCaseIds } = useNotifications();
  return (
    <Tab.Navigator screenOptions={({ navigation, route }) => ({
      ...tabHeader(navigation),
      tabBarActiveTintColor: colors.blue600,
      tabBarInactiveTintColor: colors.gray500,
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name]} size={size} color={color} />
    })}>
      <Tab.Screen name="EventsTab" component={DiscoverScreen} options={{ title: t("tabs.events") }} />
      {user ? <Tab.Screen name="TicketsTab" component={OrdersScreen} options={{ title: t("tabs.tickets") }} /> : null}
      {isStaff ? <Tab.Screen name="CheckinTab" component={CheckinEventsScreen} options={{ title: t("tabs.checkin") }} /> : null}
      {isOrganizer ? <Tab.Screen name="OrganizerTab" component={OrganizerDashboardScreen} options={{ title: t("tabs.organizer") }} /> : null}
      {user ? (
        <Tab.Screen name="SupportTab" component={SupportListScreen}
          options={{ title: t("tabs.support"), tabBarBadge: unreadCaseIds.size ? unreadCaseIds.size : undefined }} />
      ) : null}
      <Tab.Screen name="AccountTab" component={AccountScreen} options={{ title: t("tabs.account") }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { ready, user } = useAuth();
  const { t } = useI18n();
  if (!ready) return <View style={st.center}><ActivityIndicator size="large" color={colors.blue600} /></View>;

  const detail = { headerTintColor: colors.blue600, headerTitleStyle: { color: colors.gray900, fontWeight: "700" }, headerBackButtonDisplayMode: "minimal" };
  return (
    <Stack.Navigator screenOptions={detail}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ title: "" }} />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: t("auth.login") }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: t("auth.signup") }} />
      <Stack.Screen name="Forgot" component={ForgotScreen} options={{ title: t("auth.forgotTitle") }} />
      {user ? (
        <>
          <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: t("checkout.title"), presentation: "modal" }} />
          <Stack.Screen name="Order" component={OrderScreen} options={{ title: t("orders.order") }} />
          <Stack.Screen name="Ticket" component={TicketScreen} options={{ title: t("ticket.eTicket") }} />
          <Stack.Screen name="NewCase" component={NewCaseScreen} options={{ title: t("support.newTitle") }} />
          <Stack.Screen name="SupportCase" component={SupportCaseScreen} options={{ title: t("support.title") }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t("notifications.title") }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: t("profile.title") }} />
          <Stack.Screen name="ManageEvent" component={ManageEventScreen} options={{ title: t("organizer.manage") }} />
          <Stack.Screen name="EventAnalytics" component={EventAnalyticsScreen} options={{ title: t("organizer.analytics") }} />
          <Stack.Screen name="CheckinEvent" component={CheckinEventScreen} options={{ title: t("tabs.checkin") }} />
        </>
      ) : null}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <NotificationsProvider>
            <ScanLogProvider>
              <NavigationContainer theme={theme}>
                <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
                <Root />
              </NavigationContainer>
            </ScanLogProvider>
          </NotificationsProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.gray50 },
  brand: { fontSize: 20, fontWeight: "700", color: colors.blue600 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12, marginRight: 12 },
  bell: { padding: 2 },
  bellBadge: { position: "absolute", top: -4, right: -6, backgroundColor: colors.red600, borderRadius: 8, paddingHorizontal: 4, minWidth: 16, alignItems: "center" },
  bellText: { color: colors.white, fontSize: 10, fontWeight: "700" }
});
