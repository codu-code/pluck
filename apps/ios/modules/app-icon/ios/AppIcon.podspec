Pod::Spec.new do |s|
  s.name           = 'AppIcon'
  s.version        = '1.0.0'
  s.summary        = 'Alternate app icons for Pluck'
  s.license        = 'MIT'
  s.author         = 'Pluck'
  s.homepage       = 'https://getpluck.io'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
