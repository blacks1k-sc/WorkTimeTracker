import Expo
import React
import ReactAppDependencyProvider

// @generated begin react-native-maps-import - expo prebuild (DO NOT MODIFY) sync-bee50fec513f89284e0fa3f5d935afdde33af98f
#if canImport(GoogleMaps)
import GoogleMaps
#endif
// @generated end react-native-maps-import
@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

// @generated begin react-native-maps-init - expo prebuild (DO NOT MODIFY) sync-ac1e6e2718bc5f903c5d429739f10489db0d6f64
#if canImport(GoogleMaps)
GMSServices.provideAPIKey("AIzaSyAMt7DavYfCkVq-_PeMlPtV1O5lwYIj_68")
#endif
// @generated end react-native-maps-init
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
#if DEBUG
    // In DEBUG mode, try to connect to Metro bundler for hot reload
    return bridge.bundleURL ?? bundleURL()
#else
    // In RELEASE mode, always use the bundled JavaScript (no Metro needed)
    if let bundleURL = Bundle.main.url(forResource: "main", withExtension: "jsbundle") {
      return bundleURL
    }
    // Fallback to bridge bundle URL if embedded bundle not found
    return bridge.bundleURL ?? bundleURL()
#endif
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
