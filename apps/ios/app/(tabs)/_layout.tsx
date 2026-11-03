import { Tabs } from "expo-router";
import { useColumns } from "@/components/split/context";
import { Split } from "@/components/split/Split";
import { TabBar } from "@/components/TabBar";

// iPhone: the four tabs and the tab bar. iPad from 600 wide: the same screens in the split view's list column, with
// the sidebar in place of the tab bar (lib/layout.ts).
export default function TabsLayout() {
  const { wide } = useColumns();
  return (
    <Split>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => (wide ? null : <TabBar {...props} />)}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="later" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="lists" />
      </Tabs>
    </Split>
  );
}
