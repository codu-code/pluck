Pod::Spec.new do |s|
  s.name           = 'KeyCommands'
  s.version        = '1.0.0'
  s.summary        = 'Hardware keyboard shortcuts for Pluck, in the hold-Command overlay'
  s.license        = 'Apache-2.0'
  s.author         = 'Pluck'
  s.homepage       = 'https://getpluck.io'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
