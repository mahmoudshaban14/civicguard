import { useState } from 'react';
import { Alert, View } from 'react-native';
import * as Location from 'expo-location';
import { Button, Typography } from 'heroui-native';
import { Crosshair, MapPin } from 'lucide-react-native';
import { router } from 'expo-router';
import MapView from '@/components/MapView';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
import { NEW_CAIRO_REGION } from '@/lib/civicguard-data';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function ReportLocationScreen() {
  const { draft, updateDraft } = useCivicGuard();
  const [locating, setLocating] = useState(false);
  const locate = async () => {
    setLocating(true);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.granted) {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      updateDraft({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        area: 'Current GPS location',
      });
    } else
      Alert.alert(
        'Using default location',
        'Location access was not granted. Default New Cairo coordinates will be used.',
      );
    setLocating(false);
  };
  const coordinate = { latitude: draft.latitude, longitude: draft.longitude };
  return (
    <Screen scroll={false}>
      <AppHeader title="Where is the problem?" eyebrow="STEP 2 OF 3 · LOCATION" showBack />
      <View className="border-border flex-1 overflow-hidden rounded-[28px] border">
        <MapView
          initialRegion={{ ...NEW_CAIRO_REGION, ...coordinate }}
          markers={[{ id: 'draft', coordinate, title: 'Problem location', color: '#E85D3F' }]}
          showsUserLocation
          style={{ flex: 1 }}
        />
      </View>
      <View className="border-border bg-surface mx-3 -mt-5 rounded-3xl border p-4 shadow-sm">
        <View className="mb-4 flex-row items-center">
          <View className="bg-civic-mint mr-3 size-11 items-center justify-center rounded-2xl">
            <MapPin size={22} color="#167A62" />
          </View>
          <View>
            <Typography.Paragraph className="text-muted text-xs">
              Current Location
            </Typography.Paragraph>
            <Typography.Paragraph className="font-semibold">{draft.area}</Typography.Paragraph>
          </View>
        </View>
        <View className="flex-row">
          <Data label="Latitude" value={draft.latitude.toFixed(5)} />
          <Data label="Longitude" value={draft.longitude.toFixed(5)} />
        </View>
        <Button variant="secondary" className="mt-4" isDisabled={locating} onPress={locate}>
          <Crosshair size={18} color="#167A62" />
          <Button.Label>{locating ? 'Locating...' : 'Use My GPS'}</Button.Label>
        </Button>
      </View>
      <Button className="mt-4" onPress={() => router.push('/report/description')}>
        <Button.Label>Confirm Location</Button.Label>
      </Button>
    </Screen>
  );
}
function Data({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Typography.Paragraph className="text-muted text-xs">{label}</Typography.Paragraph>
      <Typography.Paragraph className="mt-1 text-sm font-medium">{value}</Typography.Paragraph>
    </View>
  );
}
