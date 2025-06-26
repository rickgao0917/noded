import { FeatureFlagService } from '../../src/services/feature-flag-service';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    service = FeatureFlagService.getInstance();
  });

  describe('isEnabled', () => {
    it('should return false for userDiscovery by default', () => {
      expect(service.isEnabled('userDiscovery')).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should toggle feature flag from false to true', () => {
      expect(service.isEnabled('userDiscovery')).toBe(false);
      
      service.toggle('userDiscovery');
      
      expect(service.isEnabled('userDiscovery')).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'noded-feature-flags',
        JSON.stringify({ userDiscovery: true })
      );
    });

    it('should toggle feature flag from true to false', () => {
      service.toggle('userDiscovery'); // Set to true first
      service.toggle('userDiscovery'); // Toggle back to false
      
      expect(service.isEnabled('userDiscovery')).toBe(false);
    });
  });

  describe('setFlag', () => {
    it('should set feature flag to true', () => {
      service.setFlag('userDiscovery', true);
      
      expect(service.isEnabled('userDiscovery')).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'noded-feature-flags',
        JSON.stringify({ userDiscovery: true })
      );
    });

    it('should set feature flag to false', () => {
      service.setFlag('userDiscovery', false);
      
      expect(service.isEnabled('userDiscovery')).toBe(false);
    });
  });

  describe('getAllFlags', () => {
    it('should return all current flags', () => {
      const flags = service.getAllFlags();
      
      expect(flags).toEqual({ userDiscovery: false });
    });

    it('should return updated flags after toggle', () => {
      service.toggle('userDiscovery');
      const flags = service.getAllFlags();
      
      expect(flags).toEqual({ userDiscovery: true });
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all flags to default values', () => {
      service.setFlag('userDiscovery', true);
      
      service.resetToDefaults();
      
      expect(service.isEnabled('userDiscovery')).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('noded-feature-flags');
    });
  });

  describe('localStorage integration', () => {
    it('should load flags from localStorage on initialization', () => {
      mockLocalStorage.setItem('noded-feature-flags', JSON.stringify({ userDiscovery: true }));
      
      // Create new instance to test loading
      const newService = FeatureFlagService.getInstance();
      
      expect(newService.isEnabled('userDiscovery')).toBe(true);
    });

    it('should handle corrupted localStorage data', () => {
      mockLocalStorage.setItem('noded-feature-flags', 'invalid-json');
      
      // Should not throw and should use defaults
      const newService = FeatureFlagService.getInstance();
      
      expect(newService.isEnabled('userDiscovery')).toBe(false);
    });

    it('should validate localStorage data types', () => {
      mockLocalStorage.setItem('noded-feature-flags', JSON.stringify({ 
        userDiscovery: 'not-a-boolean'
      }));
      
      const newService = FeatureFlagService.getInstance();
      
      // Should fall back to default value
      expect(newService.isEnabled('userDiscovery')).toBe(false);
    });
  });
});