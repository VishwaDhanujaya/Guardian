export default undefined;

/**
 * No-op hook on web and Android because the tab bar does not overlap scroll content.
 */
export function useBottomTabOverflow() {
  return 0;
}
