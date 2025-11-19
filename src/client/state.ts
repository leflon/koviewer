/**
 * Global state of the application
 */
type State = {
    /**
     * Whether a mouse event is being transmitted between synced maps, to prevent messing with drag interactions
     */
    isTransmittingMouseEvent: boolean;
    
}