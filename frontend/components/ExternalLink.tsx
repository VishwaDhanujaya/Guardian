import { Href, Link } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { type ComponentProps } from 'react';
import { Platform } from 'react-native';

/**
 * Props for the external link wrapper that ensures consistent browser behavior across platforms.
 */
type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string };

/**
 * Renders a link that opens in the system browser on web and the in-app browser on native
 * platforms to keep the navigation experience consistent.
 */
export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (Platform.OS !== 'web') {
          // Avoid handing control to the native browser so we can present the in-app experience.
          event.preventDefault();
          await openBrowserAsync(href);
        }
      }}
    />
  );
}
