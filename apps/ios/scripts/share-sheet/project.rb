# Writes ShareSheet.xcodeproj beside this file: one UI test bundle with no app of its own (the test drives Safari).
# Run with the Ruby and gems CocoaPods brings, which include xcodeproj (scripts/share-sheet.sh does).
require "fileutils"
require "xcodeproj"

path = File.join(__dir__, "ShareSheet.xcodeproj")
FileUtils.rm_rf(path)
project = Xcodeproj::Project.new(path)
target = project.new_target(:ui_test_bundle, "ShareSheetTests", :ios, "17.0")
target.add_file_references([project.main_group.new_file("ShareSheetTests.swift")])
target.build_configurations.each do |c|
  c.build_settings.merge!("PRODUCT_BUNDLE_IDENTIFIER" => "io.getpluck.share-sheet-tests", "GENERATE_INFOPLIST_FILE" => "YES",
                          "SWIFT_VERSION" => "5.0", "CODE_SIGN_IDENTITY" => "-", "CODE_SIGN_STYLE" => "Manual", "TARGETED_DEVICE_FAMILY" => "1,2")
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_test_target(target)
scheme.save_as(path, "ShareSheetTests", true)
